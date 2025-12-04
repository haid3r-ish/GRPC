// ANSI Escape Codes for Backgrounds
const bg = {
    blue: "\x1b[44m",
    red: "\x1b[41m",
    yellow: "\x1b[43m",
    green: "\x1b[42m",
    magenta: "\x1b[45m"
};

// ANSI Escape Codes for Text Color (Foreground)
const fg = {
    black: "\x1b[30m", // High contrast for yellow/white backgrounds
    white: "\x1b[37m", // High contrast for dark backgrounds
};

// Reset Code
const reset = "\x1b[0m";

const cons = {
    /**
     * Info: Blue Background with White Text
     */
    info: (text) => {
        console.log(`${bg.blue}${fg.white} ${text} ${reset}`);
    },

    /**
     * Error: Red Background with White Text
     */
    err: (text) => {
        console.log(`${bg.red}${fg.white} ${text} ${reset}`);
    },

    /**
     * Warning: Yellow Background with Black Text (for readability)
     */
    warn: (text) => {
        console.log(`${bg.yellow}${fg.black} ${text} ${reset}`);
    },

    /**
     * Success: Green Background with Black Text
     */
    success: (text) => {
        console.log(`${bg.green}${fg.black} ${text} ${reset}`);
    },

    /**
     * Debug: Magenta Background with White Text
     */
    debug: (text) => {
        console.log(`${bg.magenta}${fg.white} ${text} ${reset}`);
    }
};

module.exports = cons;