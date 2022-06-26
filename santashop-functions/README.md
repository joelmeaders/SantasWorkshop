10/10/2021

// THIS STEP NEEDED FOR RECAPTCHA & SENDGRID
// https://firebase.google.com/docs/functions/local-emulator
Set up functions configuration (optional)
If you're using custom functions configuration variables, first run the command to get your custom config (run this within the functions directory) in your local environment:
firebase functions:config:get > .runtimeconfig.json

# If using Windows PowerShell, replace the above with:

# firebase functions:config:get | ac .runtimeconfig.json

if prompted for webpack cli install, cancel and then run 'npm link webpack' in the console

Running pub/sub manually during development:
user@laptop:~$ firebase functions:shell
firebase > myCronFunction()
