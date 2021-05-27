# DEV posts to blog action

This is a JS github action that checks my DEV posts and create markdown files for new ones.

This is based on [dev-posts-to-jekyll-markdown-action](https://github.com/bencgreenberg/dev-posts-to-jekyll-markdown-action) by [bencgreenberg](https://github.com/bencgreenberg).

Things changed:

- Pull in the entire blog post instead of creating cards.
- Calculate the difference and pull in that amount of posts.
- Do not delete any existing posts on my Jekyll site.
  