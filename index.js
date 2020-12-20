const core = require("@actions/core");
const github = require("@actions/github");

// try {
//   // `who-to-greet` input defined in action metadata file
//   const nameToGreet = core.getInput('who-to-greet');
//   console.log(`Hello ${nameToGreet}!`);
//   const time = (new Date()).toTimeString();
//   core.setOutput("time", time);
//   // Get the JSON webhook payload for the event that triggered the workflow
//   const payload = JSON.stringify(github.context.payload, undefined, 2)
//   console.log(`The event payload: ${payload}`);
// } catch (error) {
//   core.setFailed(error.message);
// }

const { Toolkit } = require("actions-toolkit");
const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios").default;
const btoa = require("btoa");

try {
	Toolkit.run(async (tools) => {
		// Assign owner and repo data to variables

		const owner = secrets.REPO_OWNER;
		const repo = secrets.REPO;

		// Get the latest post in my jekyll site
		var path = "_posts";
		var myPosts; // All posts in repo
		var myPostDate; // Latest repo post date
		var refsData; // Data on Current Repo Refs
		var newJekyllPostFileName;

		// Get repo posts data
		myPosts = (
			await tools.github.repos.getContents({
				owner,
				repo,
				path,
			})
		).data;

		myPostDate = myPosts[0]["name"].slice(0, 10);

		// Get the latest DEV posts
		var devPosts;
		var devPostDate;
		var devPostTitle;
		var devPostURL;
		var masterRepoSHA; // SHA of Master Branch in Repo
		var devPostContent;
		var checkPostAmount;

		// Create headers for DEV request
		var headers = {
			"Content-Type": "application/json",
			"api-key": `${secrets.DEV_API_KEY}`,
		};

		// Make the API calls
		const getData = () => {
			return axios({
				method: "get",
				url: "https://dev.to/api/articles/me?page=1&per_page=6",
				headers: headers,
			});
		};

		// Assign DEV data
		devPosts = (await getData()).data;
		checkPostAmount = devPosts.length > 10 ? 10 : devPosts.length;

		for (let index = 0; index < checkPostAmount; index++) {
			devPostDate = devPosts[index]["published_at"]; // ex. 2020-02-12T12:45:27.741Z
			if (new Date(devPostDate) >= new Date(myPostDate)) {
				devPostTitle = devPosts[index]["title"];
				devPostURL = devPosts[index]["url"];
				devPostContent = devPosts[index]["body_markdown"];
				newJekyllPostFileName = `${devPostDate.split("T")[0]}-${devPostTitle.toLowerCase().split(" ").join("-")}.md`;

				// Create Markdown File
				const fileContents = `      
        ---
        layout: post
        category: dev
        date: ${devPostDate}
        title: ${devPostTitle}
        link: ${devPostURL}
        ---
        ${devPostContent}
        `.trim();

				// Remove extraneous indentation
				fileContents = fileContents.replace(/^ {4}/gm, "");

				// Encode it in Base64 Encoding
				const encodedContents = btoa(fileContents);

				// Get list of repo branches
				refsData = (
					await tools.github.git.listRefs({
						owner,
						repo,
					})
				).data;

				// If branch does not exist, create branch
				if (refsData.filter((data) => data.ref == "refs/heads/dev_to_jekyll").length == 0) {
					// Get Master Branch SHA
					refsFiltered = refsdata.filter((ref) => ref.ref == "refs/heads/master");
					masterRepoSHA = refsFiltered[0]["object"]["sha"];

					// Create a New Branch for the PR
					newBranch = await tools.github.git.createRef({
						owner,
						repo,
						ref: "refs/heads/dev_to_jekyll",
						sha: masterRepoSHA,
					});

					// Create a new file in the new branch
					newFile = await tools.github.repos.createOrUpdateFile({
						owner,
						repo,
						branch: "dev_to_jekyll",
						path: `_posts/${newJekyllPostFileName}`,
						message: `New markdown file for ${devPostTitle}`,
						content: encodedContents,
					});
				}

				// Create Pull Request
				// Get list of all pull requests in working branch
				var prArray = (
					await tools.github.pulls.list({
						owner,
						repo,
						head: "dev_to_jekyll",
					})
				).data;

				var prArrayFiltered = prArray.filter((pr) => pr.title == `New DEV Post: ${devPostTitle}`);

				// If PR exists, update current pull request
				if (prArrayFiltered.length > 0) {
					var prNumber = prArrayFiltered[0].number;
					newPr = await tools.github.pulls.update({
						owner,
						repo,
						pull_number: prNumber,
					});
					tools.log.success("PR updated");

					// If PR does not exist, create a new one
				} else if (prArrayFiltered.length == 0) {
					newPR = await tools.github.pulls.create({
						owner,
						repo,
						title: `New DEV Post: ${devPostTitle}`,
						head: "dev_to_jekyll",
						base: "master",
						body: `Automated PR to add the new DEV blog post, ${devPostTitle}, to your Jekyll site as markdown.`,
					});
					tools.log.success("PR created");
				}
				tools.exit.success("Processing complete");
			}
		}
		tools.exit.success("There are no posts on DEV newer than the posts on your Jekyll site.");
	});

	const payload = JSON.stringify(github.context.payload, undefined, 2);
	console.log(`The event payload: ${payload}`);
} catch (error) {
	core.setFailed(error.message);
}
