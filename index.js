/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
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
  });

  app.on("issues.opened", async (context) => {
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
    const openIssues = number_Issues.filter((issue) => issue.state === "open");
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
  });

  app.on("issue_comment.created", async (context) => {
    context.log("Issue comment created");

    if (context.payload.comment.user.type === "Bot") {
      context.log("comment user type is bot, returning... ");
      return;
    }
    // labels
    const authorAssociation = context.payload.comment.author_association;
    if (authorAssociation === "OWNER" || authorAssociation === "COLLABORATOR") {
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
          const existingLabels = await context.octokit.issues.listLabelsOnIssue(
            context.issue()
          );
          const existingLabelsNames = existingLabels.data.map(
            (label) => label.name
          );

          console.log("Existing Labels:", existingLabelsNames);
          console.log("Labels to Remove:", trimmedLabelsToRemove);

          const labelsToRemoveFiltered = trimmedLabelsToRemove.filter((label) =>
            existingLabelsNames.includes(label)
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
  });

  app.onAny(async (context) => {
    context.log.info({ event: context.name, action: context.payload.action });
  });

  app.onError(async (error) => {
    app.log.error(error);
  });

  app.on("pull_request.opened", async (context) => {
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
  });

  app.on("pull_request.opened", async (context) => {
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
    const closedIssues = number_PR.filter((issue) => issue.state === "closed");

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
  });
};
