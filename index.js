/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");
  const WebServer = process.env.SERVER;
  console.log({ WebServer });
  // setInterval(async()=>{
  //   const isServerRunning = await checkServerStatus(WebServer);
  //   console.log({ isServerRunning });
  // },1000)

  app.on("issues.opened", async (context) => {
    const isServerRunning = await checkServerStatus(WebServer);
    const mainFunctionality = async () => {
      const issue = context.payload.issue;
      const user = issue.user.login;
      // greeting
      const issueComment = context.issue({
        body: `Thanks **@${user}** for opening this issue!\n\nFor **COLLABORATOR** only : 
      \n - To add labels, comment on the issue 
      \`${"/label add label1,label2,label3"}\`
      \n - To remove labels, comment on the issue 
      \`${"/label remove label1,label2,label3"}\`
      `,
      });
      return context.octokit.issues.createComment(issueComment);
    };
    if (isServerRunning) {
      mainFunctionality();
    } else {
      context.log.warn(
        "Server is down, waiting for 30 seconds before retrying..."
      );
      await delay(30000);
      mainFunctionality();
    }
  });

  app.on("issues.opened", async (context) => {
    const isServerRunning = await checkServerStatus(WebServer);
    const mainFunctionality = async () => {
      const issue = context.payload.issue;
      const user = issue.user.login;
      context.log(context);
      const res = await context.octokit.issues.listForRepo(
        context.repo({
          state: "all",
          creator: context.payload.issue.user.login,
        })
      );
      context.log({ res });

      // issues numbers
      const number_Issues = res.data.filter((data) => !data.pull_request);
      const openIssues = number_Issues.filter(
        (issue) => issue.state === "open"
      );
      const closedIssues = number_Issues.filter(
        (issue) => issue.state === "closed"
      );

      if (number_Issues.length === 1)
        try {
          context.octokit.issues.createComment(
            context.issue({
              body: `*First issue by @${user}* \n\n *Issues Details of @${user}* in [${context.payload.repository.name}](${context.payload.repository.html_url}) :\n | OPEN | CLOSED | TOTAL | \n |----|----|----| \n | ${openIssues.length} | ${closedIssues.length} | **${number_Issues.length}** |`,
            })
          );
        } catch (err) {
          if (err.code != 404) {
            throw err;
          }
        }
      else {
        try {
          context.octokit.issues.createComment(
            context.issue({
              body: `*Issues Details of @${user}* in [${context.payload.repository.name}](${context.payload.repository.html_url}) :\n | OPEN | CLOSED | TOTAL | \n |----|----|----| \n | ${openIssues.length} | ${closedIssues.length} | **${number_Issues.length}** |`,
            })
          );
        } catch (err) {
          if (err.code != 404) {
            throw err;
          }
        }
      }

      // labels
      if (
        context.payload.issue.author_association === "OWNER" ||
        context.payload.issue.author_association === "COLLABORATOR"
      ) {
        // Check for the label command in the comment body
        const commentBody = context.payload.issue.body || "";
        const labelCommandRegex = /\/label add (.+)/;
        const match = commentBody.match(labelCommandRegex);

        if (match) {
          const labels = match[1].split(/,/);
          const trimmedLabels = labels.map((label) => label.trim());
          app.log({ labels });
          await context.octokit.issues.addLabels(
            context.issue({ labels: trimmedLabels })
          );

          // Acknowledge label addition
          await context.octokit.issues.createComment(
            context.issue({
              body: `Added labels: **${labels.join(", ")}**`,
            })
          );
        }
      }
    };
    if (isServerRunning) {
      mainFunctionality();
    } else {
      context.log.warn(
        "Server is down, waiting for 30 seconds before retrying..."
      );
      await delay(30000);
      mainFunctionality();
    }
  });

  app.on("issue_comment.created", async (context) => {
    const isServerRunning = await checkServerStatus(WebServer);
    const mainFunctionality = async () => {
      context.log("Issue comment created");

      if (context.payload.comment.user.type === "Bot") {
        context.log("comment user type is bot, returning... ");
        return;
      }
      // labels
      const authorAssociation = context.payload.comment.author_association;
      if (
        authorAssociation === "OWNER" ||
        authorAssociation === "COLLABORATOR"
      ) {
        // Check for the label command in the comment body
        const commentBody = context.payload.comment.body || "";
        const labelCommandRegex = /\/label add (.+)/;
        const match = commentBody.match(labelCommandRegex);
        const labelCommandRegexRm = /\/label remove (.+)/;
        const matchRm = commentBody.match(labelCommandRegexRm);

        if (match) {
          const labels = match[1].split(/,/);
          const trimmedLabels = labels.map((label) => label.trim());
          // labels.map((ele) => (ele = ele.trim()));
          await context.octokit.issues.addLabels(
            context.issue({ labels: trimmedLabels })
          );

          // Acknowledge label addition
          await context.octokit.issues.createComment(
            context.issue({
              body: `Added labels: **${labels.join(", ")}**`,
            })
          );
        }
        if (matchRm) {
          const labelsToRemove = matchRm[1].split(/,/);
          const trimmedLabelsToRemove = labelsToRemove.map((label) =>
            label.trim()
          );

          try {
            // Check if labels exist before trying to remove them
            const existingLabels =
              await context.octokit.issues.listLabelsOnIssue(context.issue());
            const existingLabelsNames = existingLabels.data.map(
              (label) => label.name
            );

            console.log("Existing Labels:", existingLabelsNames);
            console.log("Labels to Remove:", trimmedLabelsToRemove);

            const labelsToRemoveFiltered = trimmedLabelsToRemove.filter(
              (label) => existingLabelsNames.includes(label)
            );

            console.log("Labels to Remove (Filtered):", labelsToRemoveFiltered);

            if (labelsToRemoveFiltered.length > 0) {
              // Remove labels only if they exist on the issue
              for (let i in labelsToRemoveFiltered) {
                await context.octokit.issues.removeLabel({
                  owner: context.payload.repository.owner.login,
                  repo: context.payload.repository.name,
                  issue_number: context.payload.issue.number,
                  name: labelsToRemoveFiltered[i],
                });
              }

              // Acknowledge label removal
              await context.octokit.issues.createComment(
                context.issue({
                  body: `Removed labels: **${labelsToRemoveFiltered.join(
                    ", "
                  )}**`,
                })
              );
            } else {
              // Acknowledge that the labels were not found
              await context.octokit.issues.createComment(
                context.issue({
                  body: `Labels not found: **${trimmedLabelsToRemove.join(
                    ", "
                  )}**`,
                })
              );
            }
          } catch (error) {
            // Handle error if labels cannot be removed
            console.error("Error removing labels:", error);

            // Acknowledge the error in a comment
            await context.octokit.issues.createComment(
              context.issue({
                body: `Error removing labels: ${error.message}`,
              })
            );
          }
        }
      }
    };
    if (isServerRunning) {
      mainFunctionality();
    } else {
      context.log.warn(
        "Server is down, waiting for 30 seconds before retrying..."
      );
      await delay(30000);
      mainFunctionality();
    }
  });

  app.onAny(async (context) => {
    const isServerRunning = await checkServerStatus(WebServer);
    const mainFunctionality = async () => {
      context.log.info({ event: context.name, action: context.payload.action });
    };
    if (isServerRunning) {
      mainFunctionality();
    } else {
      context.log.warn(
        "Server is down, waiting for 30 seconds before retrying..."
      );
      await delay(30000);
      mainFunctionality();
    }
  });

  app.onError(async (error) => {
    const isServerRunning = await checkServerStatus(WebServer);
    const mainFunctionality = async () => {
      app.log.error(error);
    };
    if (isServerRunning) {
      mainFunctionality();
    } else {
      context.log.warn(
        "Server is down, waiting for 30 seconds before retrying..."
      );
      await delay(30000);
      mainFunctionality();
    }
  });

  app.on("pull_request.opened", async (context) => {
    const isServerRunning = await checkServerStatus(WebServer);
    const mainFunctionality = async () => {
      const issue = context.payload.pull_request;
      const user = issue.user.login;

      // greeting
      const issueComment = context.issue({
        body: `Thanks **@${user}** for opening this PR!\n\nFor **COLLABORATOR** only : 
      \n - To add labels, comment on the issue 
      \`${"/label add label1,label2,label3"}\`
      \n - To remove labels, comment on the issue 
      \`${"/label remove label1,label2,label3"}\`
      `,
      });
      return context.octokit.issues.createComment(issueComment);
    };
    if (isServerRunning) {
      mainFunctionality();
    } else {
      context.log.warn(
        "Server is down, waiting for 30 seconds before retrying..."
      );
      await delay(30000);
      mainFunctionality();
    }
  });

  app.on("pull_request.opened", async (context) => {
    const isServerRunning = await checkServerStatus(WebServer);
    const mainFunctionality = async () => {
      const issue = context.payload.pull_request;
      const user = issue.user.login;
      context.log(context);
      // const res = await context.octokit.pulls.list
      const res = await context.octokit.pulls.list(
        context.repo({
          state: "all",
          creator: context.payload.pull_request.user.login,
        })
      );
      context.log({ res });

      // issues numbers
      const number_PR = res.data.filter((data) => !data.issues);
      // console.log("+++++++++++++++++++++++++++++==================");
      // console.log(res.data);
      // console.log("+++++++++++++++++++++++++++++==================");
      const openIssues = number_PR.filter((issue) => issue.state === "open");
      const closedIssues = number_PR.filter(
        (issue) => issue.state === "closed"
      );

      if (number_PR.length === 1)
        try {
          context.octokit.issues.createComment(
            context.issue({
              body: `*First PR by @${user}*\n\n *PR Details of @${user}* in [${context.payload.repository.name}](${context.payload.repository.html_url}) :\n | OPEN | CLOSED | TOTAL | \n |----|----|----| \n | ${openIssues.length} | ${closedIssues.length} | **${number_PR.length}** |`,
            })
          );
        } catch (err) {
          if (err.code != 404) {
            throw err;
          }
        }
      else {
        try {
          context.octokit.issues.createComment(
            context.issue({
              body: `*PR Details of @${user}* in [${context.payload.repository.name}](${context.payload.repository.html_url}) :\n | OPEN | CLOSED | TOTAL | \n |----|----|----| \n | ${openIssues.length} | ${closedIssues.length} | **${number_PR.length}** |`,
            })
          );
        } catch (err) {
          if (err.code != 404) {
            throw err;
          }
        }
      }

      // labels
      if (
        context.payload.pull_request.author_association === "OWNER" ||
        context.payload.pull_request.author_association === "COLLABORATOR"
      ) {
        // Check for the label command in the comment body
        const commentBody = context.payload.pull_request.body || "";
        const labelCommandRegex = /\/label add (.+)/;
        const match = commentBody.match(labelCommandRegex);

        if (match) {
          const labels = match[1].split(/,/);
          const trimmedLabels = labels.map((label) => label.trim());
          app.log({ labels });
          await context.octokit.issues.addLabels(
            context.issue({ labels: trimmedLabels })
          );

          // Acknowledge label addition
          await context.octokit.issues.createComment(
            context.issue({
              body: `Added labels: **${labels.join(", ")}**`,
            })
          );
        }
      }
    };
    if (isServerRunning) {
      mainFunctionality();
    } else {
      context.log.warn(
        "Server is down, waiting for 30 seconds before retrying..."
      );
      await delay(30000);
      mainFunctionality();
    }
  });
};

// Function to check server status
async function checkServerStatus(healthCheckUrl) {
  try {
    const response = await fetch(healthCheckUrl);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Function for delay using Promise
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
