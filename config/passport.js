import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { userOperations } from '../mongo.js';

// Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await userOperations.findUserByEmail(email);
    
    if (!user) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    if (user.authMethod === 'google') {
      return done(null, false, { message: 'Please sign in with Google' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    let user = await userOperations.findUserByGoogleId(profile.id);
    
    if (user) {
      return done(null, user);
    }

    // Check if user exists with same email
    user = await userOperations.findUserByEmail(profile.emails[0].value);
    
    if (user) {
      // Link Google account to existing user
      await userOperations.updateUser(user._id, {
        googleId: profile.id,
        authMethod: 'both'
      });
      user.googleId = profile.id;
      user.authMethod = 'both';
      return done(null, user);
    }

    // Create new user
    const result = await userOperations.createUser({
      googleId: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value.toLowerCase(),
      authMethod: 'google',
      avatar: profile.photos[0]?.value
    });

    if (result.success) {
      const newUser = await userOperations.findUserById(result.userId);
      return done(null, newUser);
    } else {
      return done(new Error('Failed to create user'));
    }
  } catch (error) {
    return done(error);
  }
}));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userOperations.findUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;