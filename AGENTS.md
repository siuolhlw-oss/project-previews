# Preview publishing contract

- This repository is the shared preview destination; each project has its own subdirectory.
- Confirm requested feature changes with the user before implementation. Publishing a preview does not authorize merging or updating production.
- Keep source code and feature branches in their original repositories. Only publish the static files required to run the preview here.
- Record the original repository, branch and full commit in previews.json for each preview. Describe any preview-only modifications.
- Preserve other projects when adding/updating one preview. Keep an obvious preview label and index link; use relative asset URLs that work under the project subdirectory.
- Never include credentials, environment files, Git directories, personal contact data or private source files.
- Update README and the index when the preview workflow or available projects change. Verify the deployed URL and mobile interaction before reporting completion.
- Ask for explicit confirmation after testing before merging a source feature branch into production. No automatic production promotion.
