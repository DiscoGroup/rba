# Raise The Bar Agency

Static mirror of the Raise The Bar Agency website from https://raisethebaragency.com/.

## Local preview

Serve the repository root from a local web server:

```sh
python3 -m http.server 4173
```

Then open http://localhost:4173/.

## Deploy

This site is already built as static HTML, CSS, JavaScript, fonts, and images. Deploy the repository root as the public directory.

For GitHub Pages, use the root of the `main` branch and keep `.nojekyll` in place so hashed asset paths are served unchanged.
