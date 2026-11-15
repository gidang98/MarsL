// Opens a GitHub issue for /bug. Needs GITHUB_TOKEN with Issues: write.
const { githubToken, githubRepo } = require("./config");

async function createIssue({ title, body }, token = githubToken, repo = githubRepo, doFetch = fetch) {
  if (!token) return null;
  const res = await doFetch("https://api.github.com/repos/" + repo + "/issues", {
    method: "POST",
    headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "marsl-discord-bot" },
    body: JSON.stringify({ title, body }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("GitHub " + res.status);
  const issue = await res.json();
  return { number: issue.number, url: issue.html_url };
}

module.exports = { createIssue };
