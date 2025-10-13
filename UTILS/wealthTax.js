/**
 * Wealth tax system has been removed. This module remains as a stub so existing
 * code paths can detect that taxation features are disabled without errors.
 */

const logger = require('./logger');

class WealthTaxDisabled {
  constructor() {
    this.disabled = true;
    logger.info('💼 Wealth tax module disabled – taxation features are no longer active.');
  }

  isEnabled() {
    return false;
  }

  async getUserWealthTaxStatus(_userId, _guildId) {
    return {
      disabled: true,
      isSubjectToTax: false,
      reason: 'wealth_tax_disabled',
      taxAmount: 0,
      bracket: null,
      bettingAnalysis: null
    };
  }

  async getWealthTaxSummary(_guildId, _limit = 20) {
    return {
      status: 'DISABLED',
      disabled: true,
      summary: {
        totalUsers: 0,
        wealthyUsers: 0,
        taxableUsers: 0,
        highStakesGamblers: 0,
        inactiveRich: 0,
        potentialTaxRevenue: 0,
        exemptUsers: 0,
        bracketBreakdown: {}
      },
      userStatuses: []
    };
  }

  async applyWealthTax(_userId, _guildId, _username) {
    return {
      success: false,
      disabled: true,
      taxAmount: 0,
      reason: 'wealth_tax_disabled'
    };
  }

  async processWealthTaxes(_guildId, _botClient = null) {
    return {
      success: false,
      disabled: true,
      message: 'Wealth tax system disabled',
      usersProcessed: 0,
      usersTaxed: 0,
      totalTaxCollected: 0,
      taxRecords: [],
      processingTime: 0
    };
  }
}

module.exports = new WealthTaxDisabled();
