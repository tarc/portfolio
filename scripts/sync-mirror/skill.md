# Sync the GitHub mirror

The source is on Codeberg (`origin`, `tarcisio/pages`); GitHub's
`tarc/portfolio` is a read-only mirror that Codeberg pushes to. Codeberg's
sync-on-commit hasn't been firing, so after a push GitHub lags until the
8-hour scheduled sync.

1. After pushing to `origin`, run `devenv shell -- just sync-mirror`. It
   triggers the sync and waits until GitHub's `main` equals Codeberg's.
   Do this before the user starts a cloud session, which clones from GitHub.
2. On failure it prints Codeberg's mirror status. A `last_error` about
   authentication means the GitHub token in Codeberg's mirror settings
   expired or lost access; that is the user's to renew. Don't work around
   it by pushing to GitHub directly: the next sync overwrites GitHub's refs.
3. Never push to GitHub. Commits go to Codeberg only.
