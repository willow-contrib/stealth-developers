# stealth developers

discord bot for the stealth developers community.

thanks arnav (idk wat u did but thanks)

## development

### requirements

- bun
  - get it here https://bun.sh/

- a mongodb database
  - get it here https://www.mongodb.com/try/download/community
  - or, host it on a service like https://www.mongodb.com/cloud/atlas

- a discord bot token
  - create a bot here https://discord.com/developers/applications
  - add the bot to your server with the `bot` and `applications.commands`
    scopes

### setup

clone the repo and install any deps:
```sh
git clone https://github.com/willow-contrib/stealth-developers.git
cd stealth-developers
bun install
```

configure variables in `.config.{ENVIRONMENT}.json`, copy `.config.example.json`
to `.config.json` and fill in the values.

`ENVIRONMENT` is defined by the `NODE_ENV` environment variable; if not set, it
will default to `DEV`.


### running

run the bot with:
```sh
bun run start
```

### development

if you want to run the bot in development mode, you can use:
```sh
bun run dev
```

this will watch for changes in the code and automatically restart the bot when
changes are detected, beware of rate limits.

## copying

this project is licensed under the copyleft gnu agplv3.0, you can find the full
license text in [`COPYING.aglpv3`](./COPYING.agplv3).
