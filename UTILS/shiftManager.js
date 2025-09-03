/**
 * Shift Management System for ATIVE UTILITY & SECURITY Bot
 * Handles staff shift tracking, pay calculation, and auto-clock-out
 */

const cron = require('node-cron');
const dbManager = require('./database');
const logger = require('./logger');

class ShiftManager {
    constructor(client) {
        this.client = client;
        this.activeShifts = new Map(); // userId -> shift data
        this.payRates = {
            admin: 8000, // 8K per hour
            mod: 4200   // 4.2K per hour
        };
        
        // Monitoring will be started manually after database initialization
    }

    async startMonitoring() {
        // Load active shifts from database on startup
        await this.loadActiveShifts();
        
        // Check for inactive staff every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            await this.checkInactiveStaff();
        });

        // Auto-clock out check every hour
        cron.schedule('0 * * * *', async () => {
            await this.autoClockOutInactive();
        });

        logger.info('Shift monitoring started');
    }

    /**
     * Load active shifts from database on startup
     */
    async loadActiveShifts() {
        try {
            const activeShifts = await dbManager.getAllActiveShifts();
            let loadedCount = 0;
            
            for (const shift of activeShifts) {
                // Reconstruct the shift object for memory storage
                this.activeShifts.set(shift.user_id, {
                    shiftId: shift.id,
                    userId: shift.user_id,
                    guildId: shift.guild_id,
                    role: shift.role,
                    clockInTime: new Date(shift.clock_in_time),
                    breakTime: 0, // Reset break time on restart
                    lastActivity: new Date(shift.last_activity || shift.clock_in_time),
                    status: 'active'
                });
                loadedCount++;
            }
            
            if (loadedCount > 0) {
                logger.info(`Loaded ${loadedCount} active shifts from database`);
            }
        } catch (error) {
            logger.error('Error loading active shifts from database:', error);
        }
    }

    async clockIn(userId, guildId, userRole) {
        try {
            // Check if user already has active shift
            const existingShift = await dbManager.getActiveShift(userId, guildId);
            if (existingShift) {
                return {
                    success: false,
                    message: 'You already have an active shift. Please clock out first.'
                };
            }

            // Determine role (admin or mod)
            const role = this.determineRole(userRole);
            if (!role) {
                return {
                    success: false,
                    message: 'Only admins and moderators can clock in for shifts.'
                };
            }

            // Create shift in database
            const shiftId = await dbManager.startShift(userId, guildId, role);
            
            // Store in memory for quick access
            this.activeShifts.set(userId, {
                shiftId,
                userId,
                guildId,
                role,
                clockInTime: new Date(),
                breakTime: 0,
                lastActivity: new Date(),
                status: 'active'
            });

            logger.shift('clock_in', userId, `Role: ${role}, Shift ID: ${shiftId}`);
            
            return {
                success: true,
                message: `Successfully clocked in as ${role}! Your shift has started.`,
                shiftId,
                role,
                payRate: this.payRates[role]
            };

        } catch (error) {
            logger.error('Error clocking in user:', error);
            return {
                success: false,
                message: 'An error occurred while clocking in. Please try again.'
            };
        }
    }

    async clockOut(userId, guildId, reason = 'Manual clock out') {
        try {
            const shift = this.activeShifts.get(userId);
            if (!shift) {
                return {
                    success: false,
                    message: 'You are not currently clocked in.'
                };
            }

            // Calculate hours worked and pay
            const clockOutTime = new Date();
            const hoursWorked = this.calculateHours(shift.clockInTime, clockOutTime, shift.breakTime);
            const earnings = Math.floor(hoursWorked * this.payRates[shift.role]);

            // Update database
            await dbManager.endShift(shift.shiftId, hoursWorked, earnings, reason);
            
            // Pay the user (add to their wallet)
            await dbManager.updateUserBalance(userId, guildId, earnings, 0);
            
            // Remove from active shifts
            this.activeShifts.delete(userId);

            logger.shift('clock_out', userId, `Hours: ${hoursWorked.toFixed(2)}, Earnings: ${earnings}, Reason: ${reason}`);
            logger.economy('shift_pay', userId, earnings, 'Shift completion');

            return {
                success: true,
                message: `Successfully clocked out! You worked ${hoursWorked.toFixed(2)} hours and earned $${earnings.toLocaleString()}.`,
                hoursWorked,
                earnings
            };

        } catch (error) {
            logger.error('Error clocking out user:', error);
            return {
                success: false,
                message: 'An error occurred while clocking out. Please try again.'
            };
        }
    }

    async startBreak(userId) {
        const shift = this.activeShifts.get(userId);
        if (!shift) {
            return { success: false, message: 'You are not currently clocked in.' };
        }

        if (shift.status === 'break') {
            return { success: false, message: 'You are already on break.' };
        }

        shift.status = 'break';
        shift.breakStartTime = new Date();

        logger.shift('break_start', userId, 'Break started');

        return {
            success: true,
            message: 'Break started! Use `/shift break` again to end your break.'
        };
    }

    async endBreak(userId) {
        const shift = this.activeShifts.get(userId);
        if (!shift) {
            return { success: false, message: 'You are not currently clocked in.' };
        }

        if (shift.status !== 'break') {
            return { success: false, message: 'You are not currently on break.' };
        }

        // Calculate break time
        const breakDuration = (new Date() - shift.breakStartTime) / (1000 * 60); // minutes
        shift.breakTime += breakDuration;
        shift.status = 'active';
        shift.lastActivity = new Date();
        delete shift.breakStartTime;

        logger.shift('break_end', userId, `Break duration: ${breakDuration.toFixed(1)} minutes`);

        return {
            success: true,
            message: `Break ended! Break duration: ${breakDuration.toFixed(1)} minutes.`
        };
    }

    async getShiftStatus(userId) {
        const shift = this.activeShifts.get(userId);
        if (!shift) {
            return {
                success: false,
                message: 'You are not currently clocked in.'
            };
        }

        const currentTime = new Date();
        const hoursWorked = this.calculateHours(shift.clockInTime, currentTime, shift.breakTime);
        const estimatedEarnings = Math.floor(hoursWorked * this.payRates[shift.role]);

        // Update activity in database
        await this.updateShiftActivity(userId);

        return {
            success: true,
            shift: {
                role: shift.role,
                clockInTime: shift.clockInTime,
                hoursWorked: hoursWorked.toFixed(2),
                estimatedEarnings,
                status: shift.status,
                payRate: this.payRates[shift.role]
            }
        };
    }

    async setDndMode(userId, enabled) {
        const shift = this.activeShifts.get(userId);
        if (!shift) {
            return { success: false, message: 'You are not currently clocked in.' };
        }

        shift.dndMode = enabled;
        
        logger.shift('dnd_mode', userId, `DND mode ${enabled ? 'enabled' : 'disabled'}`);

        return {
            success: true,
            message: `Do Not Disturb mode ${enabled ? 'enabled' : 'disabled'}.`
        };
    }

    updateActivity(userId) {
        const shift = this.activeShifts.get(userId);
        if (shift) {
            shift.lastActivity = new Date();
        }
    }

    async checkInactiveStaff() {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        
        for (const [userId, shift] of this.activeShifts) {
            if (shift.lastActivity < threeHoursAgo && shift.status !== 'break') {
                logger.shift('inactive_detected', userId, 'No activity for 3+ hours');
                
                // Send warning to staff member
                try {
                    const user = await this.client.users.fetch(userId);
                    if (user) {
                        await user.send('⚠️ You have been inactive for over 3 hours. You will be automatically clocked out soon if no activity is detected.');
                    }
                } catch (error) {
                    logger.error(`Failed to send inactivity warning to ${userId}:`, error);
                }
            }
        }
    }

    async autoClockOutInactive() {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const clockedOut = [];
        
        for (const [userId, shift] of this.activeShifts) {
            if (shift.lastActivity < fourHoursAgo && shift.status !== 'break') {
                const result = await this.clockOut(userId, shift.guildId, 'Auto clock-out due to inactivity (4+ hours)');
                if (result.success) {
                    clockedOut.push({ userId, ...result });
                    
                    // Notify the user
                    try {
                        const user = await this.client.users.fetch(userId);
                        if (user) {
                            await user.send(`🕐 You have been automatically clocked out due to inactivity. You worked ${result.hoursWorked.toFixed(2)} hours and earned $${result.earnings.toLocaleString()}.`);
                        }
                    } catch (error) {
                        logger.error(`Failed to send auto clock-out notification to ${userId}:`, error);
                    }
                }
            }
        }

        if (clockedOut.length > 0) {
            logger.info(`Auto-clocked out ${clockedOut.length} inactive staff members`);
        }
    }

    async clockOutAllUsers(reason = 'System shutdown') {
        const clockedOut = [];
        
        for (const [userId, shift] of this.activeShifts) {
            const result = await this.clockOut(userId, shift.guildId, reason);
            if (result.success) {
                clockedOut.push({ userId, ...result });
            }
        }

        logger.info(`Clocked out ${clockedOut.length} users due to: ${reason}`);
        return clockedOut;
    }

    isDndMode(userId) {
        const shift = this.activeShifts.get(userId);
        return shift ? shift.dndMode || false : false;
    }

    isStaffClockedIn(userId) {
        return this.activeShifts.has(userId);
    }

    getClockedInStaff(guildId) {
        const staff = [];
        for (const [userId, shift] of this.activeShifts) {
            if (shift.guildId === guildId) {
                staff.push({
                    userId,
                    role: shift.role,
                    status: shift.status,
                    clockInTime: shift.clockInTime
                });
            }
        }
        return staff;
    }

    /**
     * Update shift activity in database
     */
    async updateShiftActivity(userId) {
        try {
            const shift = this.activeShifts.get(userId);
            if (shift) {
                shift.lastActivity = new Date();
                await dbManager.updateShiftActivity(shift.shiftId);
            }
        } catch (error) {
            logger.error(`Error updating shift activity for ${userId}:`, error);
        }
    }

    determineRole(userRole) {
        // Check user's roles to determine if they're admin or mod
        if (userRole.includes('admin') || userRole.includes('administrator')) {
            return 'admin';
        } else if (userRole.includes('mod') || userRole.includes('moderator')) {
            return 'mod';
        }
        return null;
    }

    calculateHours(clockInTime, clockOutTime, breakTimeMinutes = 0) {
        const totalMs = clockOutTime - clockInTime;
        const totalHours = totalMs / (1000 * 60 * 60);
        const breakHours = breakTimeMinutes / 60;
        return Math.max(0, totalHours - breakHours);
    }

    // Generate shift report
    async generateShiftReport(userId, guildId, days = 7) {
        const query = `
            SELECT * FROM staff_shifts 
            WHERE user_id = ? AND guild_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY created_at DESC
        `;
        
        try {
            const [rows] = await dbManager.pool.execute(query, [userId, guildId, days]);
            
            let totalHours = 0;
            let totalEarnings = 0;
            
            for (const shift of rows) {
                totalHours += parseFloat(shift.hours_worked || 0);
                totalEarnings += parseFloat(shift.earnings || 0);
            }
            
            return {
                success: true,
                report: {
                    shifts: rows,
                    totalShifts: rows.length,
                    totalHours: totalHours.toFixed(2),
                    totalEarnings,
                    averageHoursPerShift: rows.length > 0 ? (totalHours / rows.length).toFixed(2) : 0,
                    days
                }
            };
        } catch (error) {
            logger.error('Error generating shift report:', error);
            return {
                success: false,
                message: 'Failed to generate shift report.'
            };
        }
    }
}

module.exports = ShiftManager;