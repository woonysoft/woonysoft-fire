# Firebase Helper Class Library

## Install
```bash
npm install firebase @woonysoft/fire
```

## Example : Initialization
```javascript
import { Fire } from '@woonysoft/fire';

Fire.initialize({
  apiKey: '****',
  authDomain: '****',
  projectId: '****',
  storageBucket: '****',
  messagingSenderId: '****',
  appId: '****',
  measurementId: '****',
});

// Reads options from .env variables
// Env variables should be defined as below
// VITE_FIRE_API_KEY=****
// VITE_FIRE_AUTH_DOMAIN=****
// VITE_FIRE_PROJECT_ID=****
// VITE_FIRE_STORAGE_BUCKET=****
// VITE_FIRE_MESSAGING_SENDER_ID=****
// VITE_FIRE_APP_ID=****
// VITE_FIRE_MEASUREMENT_ID=****
// VITE_FIRE_TEST_EMAIL=****
// VITE_FIRE_TEST_PASSWORD=****

Fire.initializeFromViteEnv();
```

## Example : SignIn / SignOut
```javascript
import { Fire } from '@woonysoft/fire';

(async () => {
  const fire = new Fire();
  try {
    const email = 'your@email.com';
    const password = 'your_password';
    await fire.signIn(email, password);
    console.assert(fire.user.email === email);
    await fire.signOut();
    console.assert(fire.user === null);
  } catch (error) {
    console.error(error);
  }
})();
```

## Example : Add / Set / Update / Delete Document
```javascript
// TODO:
```
## Example : Batch
```javascript
// TODO:
```
## Example : Query
```javascript
// TODO:
```
