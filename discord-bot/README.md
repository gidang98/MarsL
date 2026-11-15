# MarsL Discord bot

A small bot for the MarsL community server.

- `/setup` (admins only) creates the missing roles, categories and channels, and posts the welcome message, rules and role buttons. It never deletes or renames anything, so it is safe to run again.
- `/status` shows version, players and online count of OpenTest, Classic and Speed. The same card stays updated in `#server-status`.
- `/patchnotes [version]` shows the notes for a version. New versions are announced in `#patch-notes` by themselves a few minutes after a deploy, and ping the **Updates** role.
- `/bug` files a GitHub issue (needs `GITHUB_TOKEN`; without it the bot points people to `#bug-reports`).
- Role buttons in `#get-roles` let members switch the Updates, OpenTest, Classic and Speed roles on and off.

The bot only reads the public `/api/config` and `/api/patch-notes` endpoints. It does not touch the game or its data, and it is not part of `server.js` or the deploy workflow.

## Set it up

1. Open https://discord.com/developers/applications, choose **New Application**, then **Bot**, and press **Reset Token**. Copy the token.
2. Under **OAuth2 → URL Generator** choose the scopes `bot` and `applications.commands`, or open this link with your application's ID in place of `APP_ID`:
   `https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot%20applications.commands&permissions=268528656`
   Add the bot to your server.
3. In Discord, turn on **User Settings → Advanced → Developer Mode**, right-click your server icon and choose **Copy Server ID**.
4. On the machine that runs the bot (Node 20.6 or newer):
   ```
   cd discord-bot
   npm install
   cp .env.example .env     # fill in DISCORD_TOKEN and GUILD_ID
   npm start
   ```
5. In Discord, run `/setup`. Then drag the bot's role **above** the roles it hands out (Updates, OpenTest, Classic, Speed) in **Server Settings → Roles**, or the buttons cannot assign them.
6. Optional: put a GitHub token with Issues read and write access in `.env` as `GITHUB_TOKEN` to switch on `/bug`.

The bot has to keep running to answer commands and post updates. Use a process manager such as pm2, or an always-on task at your host.

## Notes

- The first run only records the current game version. Only versions released after that are announced.
- What the bot remembers (last announced version, status message) lives in `data/state.json`.
- Tests: `npm test` covers the version logic, announcements, status card, GitHub call and the layout data.
