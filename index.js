const core = require("@actions/core");
const { Toolkit } = require("actions-toolkit");
const axios = require("axios").default;
const btoa = require("btoa");
const dotenv = require("dotenv");
dotenv.config();

try {
	Toolkit.run(async (tools) => {
		const owner = process.env.REPO_OWNER;
		const repo = process.env.REPO;
		const target_branch = "dev-posts";
		const today = new Date();
		const pr_title = `Dev posts ${today.getFullYear()}/${today.getMonth() + 1}`;
		// For my latest post's date
		let myPostDate;
		let myPosts;
		let path = "_posts/dev";
		// For my latest DEV posts
		const checkPostLimit = 15;
		let newJekyllPostFileName;
		let checkPostAmount;
		let devPostContent;
		let devPostTitle;
		let devPostDate;
		let devPostURL;
		let devPosts;

		/**
		 * Get my latest post's date from the repo posts data
		 */
		myPosts = (
			await tools.github.repos.getContent({
				owner,
				repo,
				path,
			})
		).data;

		myPostDate = myPosts[0]["name"].slice(0, 10);

		/**
		 * Fetch DEV posts
		 */
		let headers = {
			"Content-Type": "application/json",
			"api-key": `${process.env.DEV_API_KEY}`,
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
		checkPostAmount = devPosts.length > checkPostLimit ? checkPostLimit : devPosts.length;

		for (let index = 0; index < checkPostAmount; index++) {
			devPostDate = devPosts[index]["published_at"]; // ex. 2020-02-12T12:45:27.741Z
			if (new Date(devPostDate) >= new Date(myPostDate)) {
				devPostTitle = devPosts[index]["title"];
				devPostURL = devPosts[index]["url"];
				devPostContent = devPosts[index]["body_markdown"];
				newJekyllPostFileName = `${devPostDate.split("T")[0]}-${devPostTitle
					.toLowerCase()
					.split(" ")
					.join("-")
					.replace(/[^a-z0-9-]/gim, "")}.md`;

				// Create Markdown File
				let fileContents = `      
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

				// Create that file in our branch
				await tools.github.repos.createOrUpdateFileContents({
					owner,
					repo,
					path: `_posts/dev/${newJekyllPostFileName}`,
					message: `New markdown file for ${devPostTitle}`,
					content: encodedContents,
					branch: target_branch,
				});
			}

			tools.log.success(`Post#${index + 1}: Added ${devPostTitle}!`);
		}

		/**
		 * Create or update a PR
		 */
		// Get list of all pull requests in working branch
		let prArray = (
			await tools.github.pulls.list({
				owner,
				repo,
				head: target_branch,
			})
		).data;
		let prArrayFiltered = prArray.filter((pr) => pr.title == pr_title);

		if (prArrayFiltered.length > 0) {
			let prNumber = prArrayFiltered[0].number;

			await tools.github.pulls.update({
				owner,
				repo,
				pull_number: prNumber,
			});

			tools.log.success("PR updated");
		} else if (prArrayFiltered.length == 0) {
			
			await tools.github.pulls.create({
				owner,
				repo,
				title: pr_title,
				head: target_branch,
				base: "master",
			});

			tools.log.success("PR created");
		}
		tools.exit.success("Done!");
	});
} catch (error) {
	core.setFailed(error.message);
}
