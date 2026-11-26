# Deploying MarsL to AlwaysData

The workflow deploys the repository's `server.js` to one or all three MarsL sites. It runs only when manually started from GitHub Actions; pushing or merging code does not restart a live server.

## Sites

| Workflow target | Site | AlwaysData site ID | SFTP user's home directory |
| --- | --- | ---: | --- |
| `opentest` | `marsl-game.com` / `www.marsl-game.com` | `1094171` | `marsl` |
| `classic` | `classic.marsl-game.com` | `1098921` | `marsl-classic` |
| `speed` | `speed.marsl-game.com` | `1098812` | `marsl-speed` |

## One-time setup

1. Create a dedicated SSH key pair for deployment. Keep the private key for the GitHub Actions secret; add only the public key in AlwaysData.
2. In AlwaysData, create three deployment users with the **SFTP-only** shell. Set each user's home directory to the matching directory in the table, disable password login, and attach the public key. SFTP-only users are jailed to their home directory. Do not use a Bash/SSH user: AlwaysData SSH users can access the whole account.
3. Obtain the SSH server key for `ssh-marsl.alwaysdata.net` and verify it against the fingerprint shown in AlwaysData under Remote access → SSH/SFTP. Store the verified `known_hosts` line as the GitHub secret `AD_KNOWN_HOSTS`.
4. Create a dedicated AlwaysData API token for the restart calls. Add it to the GitHub secret `AD_API_TOKEN`.
5. In GitHub → repository Settings → Secrets and variables → Actions, add these repository secrets:

   - `AD_DEPLOY_SSH_KEY` — the deployment private key
   - `AD_KNOWN_HOSTS` — the verified SSH host key line
   - `AD_SFTP_USER_OPENTEST` — SFTP username for the `marsl` directory
   - `AD_SFTP_USER_CLASSIC` — SFTP username for `marsl-classic`
   - `AD_SFTP_USER_SPEED` — SFTP username for `marsl-speed`
   - `AD_API_TOKEN` — the AlwaysData API token

   The account name, site IDs, and SSH host are already set in the workflow and are not secrets.

## Deploy

Open **Actions → Deploy MarsL to AlwaysData → Run workflow**, choose `all` or one server, and run it from the reviewed `main` branch. The action replaces only `server.js`, then asks AlwaysData to restart the selected site. Player databases and other files are not uploaded.

The action is manual by design. That keeps an unreviewed change from restarting a live server automatically.

## One address for every server (GATEWAY)

With the environment variable `GATEWAY=1` on the **main** site (`marsl-game.com`), the main server passes a player's traffic on to the server picked in their `marsl_srv` cookie (see `lib/gateway.js`). One Home Screen app then works with all servers and switching servers never leaves the address. It needs `HOP_SECRET` (the same text on every server, already used for hopping); the Speed and Classic sites need nothing else. Without `GATEWAY=1` nothing changes. To turn it off again, remove the variable and restart the main site; the direct `speed.` and `classic.` addresses always keep working. Each server's cookies are kept apart under the server's name, and a connected server reads the player's real address from a header the main server signs.
