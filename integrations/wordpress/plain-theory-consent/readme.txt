=== Plain Theory Consent ===
Contributors: theplaintheory
Tags: cookie consent, gdpr, ccpa, dpdpa, consent mode
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Consent banner and tracker blocking for GDPR, CCPA/CPRA and India's DPDP Act, with a tamper-evident consent log.

== Description ==

Plain Theory holds analytics and advertising scripts until a visitor chooses, shows the right notice for where they are (GDPR opt-in in Europe, CCPA opt-out in California, a DPDPA notice in India), and records every decision as a receipt you can verify.

This plugin adds the consent script to your site and lets you hold scripts that other plugins add.

* Loads first in the page, so trackers can't run early
* Hold any registered script by its handle until its category is allowed
* Google Consent Mode v2 and Global Privacy Control handled by the script
* Banner design, regions and the 22 Indian languages are managed in your Plain Theory dashboard

What this plugin doesn't do:

* No review requests, upsell notices or admin banners. Ever.
* No features locked behind the plugin. Plans and limits are the same as on theplaintheory.in/pricing.
* It doesn't store consent records in your database. They live in your Plain Theory account, in the region you chose.

== Installation ==

1. Upload the `plain-theory-consent` folder to `/wp-content/plugins/`, or install it from Plugins → Add New.
2. Activate the plugin.
3. Go to Settings → Plain Theory and paste your site key from Install in the Plain Theory dashboard.
4. Optional: under "Hold these scripts", list scripts added by other plugins, one per line, as `handle = analytics`, `handle = marketing` or `handle = functional`.

== Frequently Asked Questions ==

= Do I need a Plain Theory account? =

Yes, for the site key. The Free plan covers one site and 10,000 pageviews a month.

= How do I find a script's handle? =

It's the first argument the other plugin passed to `wp_enqueue_script()`. Many plugins list it in their docs; you can also see it as the `id` of the script tag in your page source, without the `-js` suffix.

= Will it slow my site down? =

The script is under 10 KB gzipped and served from a CDN. It's loaded without `async` on purpose so it runs before trackers.

== External services ==

This plugin loads the Plain Theory consent script from `cdn.theplaintheory.in` and sends consent decisions to the Plain Theory API so they can be recorded. Raw IP addresses are not stored; they are truncated and hashed. Terms: https://theplaintheory.in/legal/terms. Privacy notice: https://theplaintheory.in/legal/privacy.

== Changelog ==

= 0.1.0 =
* First release: script loading, load-order control, hold scripts by handle.
