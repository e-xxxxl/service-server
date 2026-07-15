// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      console.log('Google profile:', {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName
      });

      // Check if user exists with this Google ID
      let user = await User.findOne({ googleId: profile.id });
      if (user) {
        console.log('Existing Google user found');
        return done(null, user);
      }

      // Check if user exists with this email
      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        console.log('Linking Google to existing user');
        user.googleId = profile.id;
        user.profilePicture = profile.photos[0]?.value;
        user.authProvider = user.authProvider === 'local' ? 'local' : 'google';
        if (!user.isEmailVerified) {
          user.isEmailVerified = true;
          user.emailVerifiedAt = new Date();
        }
        await user.save();
        return done(null, user);
      }

      // Get accountType from state parameter
      const accountType = req.query.state || 'customer';
      console.log('Creating new user with accountType:', accountType);

      // Create new user
      const newUser = await User.create({
        fullName: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
        profilePicture: profile.photos[0]?.value,
        authProvider: 'google',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        accountType: accountType,
        password: Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16)
      });

      // If provider, create provider profile
      if (accountType === 'provider') {
        const providerProfile = await ServiceProvider.create({
          user: newUser._id,
          companyName: profile.displayName + "'s Business",
          serviceType: 'general',
          isAvailable: true
        });
        newUser.providerProfile = providerProfile._id;
        await newUser.save();
      }

      return done(null, newUser);
    } catch (error) {
      console.error('Google strategy error:', error);
      return done(error, null);
    }
  }
));

module.exports = passport;