 require("module-alias/register");

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Serialize user to session
passport.serializeUser((user, done) => {
    done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    // Extract user data from Google profile
    const user = {
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        profilePicture: profile.photos[0]?.value,
        accessToken,
        refreshToken
    };

    return done(null, user);
}));

module.exports = passport;
