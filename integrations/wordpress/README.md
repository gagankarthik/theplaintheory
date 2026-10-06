# Plain Theory Consent for WordPress

A small, dependency-free plugin that adds the Plain Theory consent script to a WordPress site.

- Prints the script first in `<head>` (`wp_head` priority 0) so trackers can't run early. It can be moved back to priority 10 in settings.
- Holds scripts registered by other plugins until their category is allowed, by handle: the `script_loader_tag` filter rewrites them to `type="text/plain" data-consent="<category>"`, which the consent script releases on consent.
- Settings live under Settings → Plain Theory (Settings API, `manage_options`, sanitised input). `uninstall.php` removes the single `ptc_settings` option.
- No review nags, admin notices or upsells.

## Install from this repo

```bash
cd integrations/wordpress
zip -r plain-theory-consent.zip plain-theory-consent
```

Upload the zip in Plugins → Add New → Upload Plugin, activate it, and paste your site key.

## Files

| File | Purpose |
| --- | --- |
| `plain-theory-consent/plain-theory-consent.php` | Plugin: script output, hold filter, settings page |
| `plain-theory-consent/uninstall.php` | Removes settings on delete |
| `plain-theory-consent/readme.txt` | WordPress.org readme |
