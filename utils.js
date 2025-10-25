// Allowed role IDs for moderation commands
const ALLOWED_ROLES = [
    '1431176927066193950',
    '1405093493902413855', 
    '1403278917028020235',
    '1413666909139767467',
    '1431173335085219900',
    '1408165119946526872'
];

// Check if user has permission to use moderation commands
function hasModPermission(member) {
    if (!member || !member.roles) return false;
    return ALLOWED_ROLES.some(roleId => member.roles.cache.has(roleId));
}

// Standard permission error response
function noPermissionReply() {
    return {
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
    };
}

module.exports = {
    ALLOWED_ROLES,
    hasModPermission,
    noPermissionReply
};