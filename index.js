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
		let path = "_posts";
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
				newJekyllPostFileName = `${devPostDate.split("T")[0]}-${devPostTitle.toLowerCase().split(" ").join("-")}.md`;

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
				tools.github.repos.createOrUpdateFileContents({
					owner,
					repo,
					branch: target_branch,
					path: `_posts/${newJekyllPostFileName}`,
					message: `New markdown file for ${devPostTitle}`,
					content: encodedContents,
				});
			}

			tools.log.success(`Post#${ index }: Added ${ devPostTitle }!`);
		}

		/**
		 * Create a PR
		 */
		tools.github.pulls.create({
			owner,
			repo,
			title: pr_title,
			head: "master",
			base: target_branch,
		});

		tools.exit.success("Done!");
	});

} catch (error) {
	core.setFailed(error.message);
}
