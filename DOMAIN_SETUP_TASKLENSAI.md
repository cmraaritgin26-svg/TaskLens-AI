# tasklensai.com Domain Setup

Goal:

```text
https://www.tasklensai.com
```

## What I Already Set Up In The Repo

- `website/CNAME` contains `www.tasklensai.com`.
- `.github/workflows/pages.yml` publishes the `website/` folder to GitHub Pages.
- Website icon paths are self-contained for GitHub Pages publishing.
- Privacy and deletion URLs now use `www.tasklensai.com`.

## Step 1: Push These Changes To GitHub

The site will not publish until these repo changes are pushed.

GitHub repo:

```text
https://github.com/cmraaritgin26-svg/TaskLens-AI
```

## Step 2: Turn On GitHub Pages

Open:

```text
https://github.com/cmraaritgin26-svg/TaskLens-AI/settings/pages
```

Set Pages source to:

```text
GitHub Actions
```

GitHub Pages docs:

```text
https://docs.github.com/en/pages
```

## Step 3: Add DNS At The Domain Registrar

Wherever you bought `tasklensai.com`, open DNS settings and add this record:

```text
Type: CNAME
Host/Name: www
Value/Target: cmraaritgin26-svg.github.io
TTL: Automatic or 1 hour
```

This makes `www.tasklensai.com` point to GitHub Pages.

GitHub custom domain docs:

```text
https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
```

## Step 4: Optional Root Domain Redirect

If the registrar supports forwarding, forward:

```text
tasklensai.com
```

to:

```text
https://www.tasklensai.com
```

If you want the root domain to work without forwarding, add these A records:

```text
Type: A
Host/Name: @
Value: 185.199.108.153

Type: A
Host/Name: @
Value: 185.199.109.153

Type: A
Host/Name: @
Value: 185.199.110.153

Type: A
Host/Name: @
Value: 185.199.111.153
```

## Step 5: Wait

DNS can take a few minutes to a few hours.

Check:

```text
https://www.tasklensai.com
https://www.tasklensai.com/privacy-policy.html
https://www.tasklensai.com/data-deletion.html
```

## Step 6: Update Google Play

Use these URLs in Play Console:

```text
Privacy policy:
https://www.tasklensai.com/privacy-policy.html

Data deletion:
https://www.tasklensai.com/data-deletion.html
```

Play Console:

```text
https://play.google.com/console
```
