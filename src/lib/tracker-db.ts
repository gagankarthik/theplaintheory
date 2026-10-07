import type { CategoryId } from "./types";

/**
 * Curated tracker database: which vendor a script, iframe, image or cookie belongs to, what it is
 * for and how long its cookies last. Written by hand from vendors' public documentation; no
 * third-party classification dataset is copied. Pure data and pure functions, safe anywhere.
 *
 * URL patterns:
 *   "host.com"        the host or any subdomain of it
 *   "host.com/path"   that host (or a subdomain) and a path starting with /path
 *   "/path"           any host, a path containing /path (first-party endpoints such as /_vercel/insights)
 * The first URL pattern is the one the SDK holds (it matches it as a substring of a script or iframe
 * address), so it must be specific to the vendor.
 *
 * Cookie names: exact, or with "*" as a wildcard ("_ga_*", "_pk_id.*").
 * Inline signatures: substrings that only this vendor's snippet contains.
 */

export interface TrackerDef {
  id: string;
  name: string;
  vendor: string;
  category: CategoryId;
  /** one line, plain language */
  purpose: string;
  urls?: string[];
  /** [name pattern, typical lifetime] */
  cookies?: [string, string][];
  inline?: string[];
}

type Opt = Pick<TrackerDef, "urls" | "cookies" | "inline">;
const d = (id: string, name: string, vendor: string, category: CategoryId, purpose: string, o: Opt = {}): TrackerDef => ({ id, name, vendor, category, purpose, ...o });

const E = "essential" as const;
const F = "functional" as const;
const A = "analytics" as const;
const M = "marketing" as const;

export const TRACKER_DB: TrackerDef[] = [
  /* ---------------- Google ---------------- */
  d("google-analytics", "Google Analytics", "Google", A, "Measures visits, sources and engagement (Google Analytics 4).", {
    urls: ["googletagmanager.com/gtag"],
    cookies: [["_ga", "2 years"], ["_ga_*", "2 years"]],
    inline: ["gtag('config', 'G-", 'gtag("config", "G-', "gtag('config','G-"],
  }),
  d("google-analytics-legacy", "Google Analytics (legacy)", "Google", A, "Measures visits with Universal Analytics or the Measurement Protocol.", {
    urls: ["google-analytics.com", "analytics.google.com"],
    cookies: [["_gid", "24 hours"], ["_gat", "1 minute"], ["_gat_*", "1 minute"], ["__utma", "2 years"], ["__utmb", "30 minutes"], ["__utmc", "Session"], ["__utmz", "6 months"], ["__utmt", "10 minutes"]],
    inline: ["GoogleAnalyticsObject", "ga('create'", 'ga("create"'],
  }),
  d("google-tag-manager", "Google Tag Manager", "Google", E, "Loads the site's other tags. Sets no cookies itself; the tags it loads are listed separately.", {
    urls: ["googletagmanager.com/gtm.js", "googletagmanager.com/ns.html"],
  }),
  d("google-ads", "Google Ads", "Google", M, "Measures ad conversions and builds remarketing audiences.", {
    urls: ["googleadservices.com", "google.com/pagead", "google.com/ads"],
    cookies: [["_gcl_au", "90 days"], ["_gcl_aw", "90 days"], ["_gcl_dc", "90 days"], ["_gcl_gb", "90 days"], ["_gac_*", "90 days"]],
    inline: ["gtag('config', 'AW-", 'gtag("config", "AW-'],
  }),
  d("doubleclick", "Google Marketing Platform (DoubleClick)", "Google", M, "Serves and measures display ads across sites.", {
    urls: ["doubleclick.net"],
    cookies: [["IDE", "13 months"], ["test_cookie", "15 minutes"], ["DSID", "2 weeks"], ["ar_debug", "3 months"]],
  }),
  d("google-adsense", "Google AdSense", "Google", M, "Shows ads on the site and shares revenue.", {
    urls: ["pagead2.googlesyndication.com", "googlesyndication.com", "adservice.google.com", "adtrafficquality.google"],
    cookies: [["__gads", "13 months"], ["__gpi", "13 months"], ["__eoi", "6 months"]],
    inline: ["adsbygoogle"],
  }),
  d("google-optimize", "Google Optimize", "Google", A, "Runs A/B tests (retired by Google in 2023; safe to remove).", {
    urls: ["googleoptimize.com"],
    cookies: [["_gaexp", "90 days"], ["_opt_*", "Session"]],
  }),
  d("google-maps", "Google Maps", "Google", F, "Shows interactive maps.", { urls: ["maps.googleapis.com", "maps.google.com", "google.com/maps"], cookies: [["NID", "6 months"]] }),
  d("youtube", "YouTube", "Google", M, "Plays embedded videos and tracks viewing for ads and recommendations.", {
    urls: ["youtube.com/embed", "youtube.com/iframe_api", "youtube.com/s/player", "youtube.com/player_api"],
    cookies: [["YSC", "Session"], ["VISITOR_INFO1_LIVE", "6 months"], ["VISITOR_PRIVACY_METADATA", "6 months"], ["PREF", "8 months"]],
  }),
  d("youtube-nocookie", "YouTube (privacy-enhanced)", "Google", F, "Plays embedded videos without setting cookies until play.", { urls: ["youtube-nocookie.com"] }),
  d("recaptcha", "Google reCAPTCHA", "Google", E, "Tells people from bots on forms.", {
    urls: ["google.com/recaptcha", "gstatic.com/recaptcha", "recaptcha.net"],
    cookies: [["_GRECAPTCHA", "6 months"]],
  }),
  d("google-hosted-libraries", "Google Hosted Libraries", "Google", E, "Serves open-source code libraries.", { urls: ["ajax.googleapis.com"] }),
  d("google-sign-in", "Sign in with Google", "Google", F, "Lets visitors sign in with their Google account.", { urls: ["accounts.google.com/gsi"], cookies: [["g_state", "6 months"]] }),
  d("google-pay", "Google Pay", "Google", E, "Processes payments.", { urls: ["pay.google.com"] }),
  d("firebase", "Firebase", "Google", F, "App backend: sign-in, database and messaging.", { urls: ["gstatic.com/firebasejs", "firebaseio.com", "firebaseapp.com"] }),
  d("google-translate", "Google Translate widget", "Google", F, "Translates the page.", { urls: ["translate.google.com/translate_a", "translate.googleapis.com"], cookies: [["googtrans", "Session"]] }),
  d("google-funding-choices", "Google Funding Choices", "Google", E, "Google's consent message for ads.", {
    urls: ["fundingchoicesmessages.google.com"],
    cookies: [["FCCDCF", "13 months"], ["FCNEC", "1 year"]],
  }),
  d("google-forms", "Google Forms", "Google", F, "Embeds a Google form.", { urls: ["docs.google.com/forms"] }),

  /* ---------------- Microsoft & LinkedIn ---------------- */
  d("microsoft-clarity", "Microsoft Clarity", "Microsoft", A, "Records sessions and heatmaps of how visitors use pages.", {
    urls: ["clarity.ms"],
    cookies: [["_clck", "1 year"], ["_clsk", "1 day"], ["CLID", "1 year"], ["ANONCHK", "10 minutes"]],
  }),
  d("microsoft-uet", "Microsoft Advertising (UET)", "Microsoft", M, "Measures Bing ad conversions and builds remarketing audiences.", {
    urls: ["bat.bing.com", "bat.bing.net"],
    cookies: [["_uetsid", "1 day"], ["_uetvid", "13 months"], ["_uetmsclkid", "90 days"], ["MUID", "13 months"]],
    inline: ["window.uetq", "uetq.push"],
  }),
  d("app-insights", "Azure Application Insights", "Microsoft", A, "Monitors page performance and errors.", {
    urls: ["js.monitor.azure.com", "az416426.vo.msecnd.net"],
    cookies: [["ai_user", "1 year"], ["ai_session", "30 minutes"]],
  }),
  d("microsoft-ajax-cdn", "Microsoft Ajax CDN", "Microsoft", E, "Serves open-source code libraries.", { urls: ["ajax.aspnetcdn.com"] }),
  d("linkedin-insight", "LinkedIn Insight", "LinkedIn", M, "Measures LinkedIn ad conversions and retargets visitors.", {
    urls: ["snap.licdn.com", "px.ads.linkedin.com", "dc.ads.linkedin.com"],
    cookies: [["li_sugr", "3 months"], ["bcookie", "1 year"], ["bscookie", "1 year"], ["lidc", "1 day"], ["UserMatchHistory", "30 days"], ["AnalyticsSyncHistory", "30 days"], ["li_fat_id", "30 days"]],
    inline: ["_linkedin_partner_id"],
  }),
  d("linkedin-plugins", "LinkedIn plugins", "LinkedIn", M, "Share buttons and profile badges from LinkedIn.", { urls: ["platform.linkedin.com"] }),

  /* ---------------- Meta ---------------- */
  d("meta-pixel", "Meta Pixel", "Meta", M, "Measures Facebook and Instagram ad conversions and builds audiences.", {
    urls: ["connect.facebook.net", "facebook.com/tr"],
    cookies: [["_fbp", "90 days"], ["_fbc", "90 days"], ["fr", "90 days"]],
    inline: ["fbq('init'", 'fbq("init"'],
  }),
  d("facebook-plugins", "Facebook social plugins", "Meta", M, "Like buttons, page boxes and comments from Facebook.", { urls: ["facebook.com/plugins", "facebook.com/v2", "facebook.com/v1"], cookies: [["datr", "2 years"]] }),
  d("instagram-embed", "Instagram embed", "Meta", M, "Shows Instagram posts.", { urls: ["instagram.com/embed", "platform.instagram.com", "cdninstagram.com"] }),

  /* ---------------- Social ad pixels ---------------- */
  d("tiktok-pixel", "TikTok Pixel", "TikTok", M, "Measures TikTok ad conversions and builds audiences.", {
    urls: ["analytics.tiktok.com"],
    cookies: [["_ttp", "13 months"], ["_tt_enable_cookie", "13 months"], ["ttcsid", "13 months"], ["ttcsid_*", "13 months"]],
    inline: ["ttq.load("],
  }),
  d("tiktok-embed", "TikTok embed", "TikTok", M, "Shows TikTok videos.", { urls: ["tiktok.com/embed"] }),
  d("x-pixel", "X (Twitter) Pixel", "X Corp", M, "Measures X ad conversions.", {
    urls: ["static.ads-twitter.com", "analytics.twitter.com", "t.co/i/adsct", "ads-api.twitter.com"],
    cookies: [["personalization_id", "13 months"], ["muc_ads", "13 months"], ["guest_id", "13 months"], ["guest_id_ads", "13 months"], ["guest_id_marketing", "13 months"]],
    inline: ["twq('init'", "twq('config'", 'twq("config"'],
  }),
  d("x-embed", "X (Twitter) embeds", "X Corp", M, "Shows posts and timelines from X.", { urls: ["platform.twitter.com", "syndication.twitter.com"] }),
  d("pinterest-tag", "Pinterest Tag", "Pinterest", M, "Measures Pinterest ad conversions.", {
    urls: ["s.pinimg.com/ct", "ct.pinterest.com"],
    cookies: [["_pinterest_ct_ua", "1 year"], ["_pin_unauth", "1 year"], ["_derived_epik", "1 year"], ["_epik", "1 year"]],
    inline: ["pintrk('load'", 'pintrk("load"'],
  }),
  d("pinterest-widgets", "Pinterest widgets", "Pinterest", M, "Save buttons and pin boards from Pinterest.", { urls: ["assets.pinterest.com"] }),
  d("snap-pixel", "Snap Pixel", "Snap", M, "Measures Snapchat ad conversions.", {
    urls: ["sc-static.net", "tr.snapchat.com"],
    cookies: [["_scid", "13 months"], ["_scid_r", "13 months"], ["_sctr", "1 year"]],
    inline: ["snaptr('init'", 'snaptr("init"'],
  }),
  d("reddit-pixel", "Reddit Pixel", "Reddit", M, "Measures Reddit ad conversions.", { urls: ["redditstatic.com/ads", "alb.reddit.com"], cookies: [["_rdt_uuid", "90 days"], ["_rdt_cid", "90 days"]], inline: ["rdt('init'"] }),
  d("quora-pixel", "Quora Pixel", "Quora", M, "Measures Quora ad conversions.", { urls: ["a.quora.com/qevents", "q.quora.com"], inline: ["qp('init'"] }),
  d("vk-pixel", "VK Pixel", "VK", M, "Measures VK ad conversions.", { urls: ["vk.com/rtrg", "vk.com/js/api/openapi"] }),
  d("line-tag", "LINE Tag", "LY Corporation", M, "Measures LINE ad conversions.", { urls: ["d.line-scdn.net", "tr.line.me"] }),
  d("kakao-pixel", "Kakao Pixel", "Kakao", M, "Measures Kakao ad conversions.", { urls: ["t1.daumcdn.net/kas"] }),

  /* ---------------- Ad tech ---------------- */
  d("amazon-ads", "Amazon Ads", "Amazon", M, "Serves and measures Amazon ads.", { urls: ["amazon-adsystem.com", "assoc-amazon.com"], cookies: [["ad-id", "7 months"], ["ad-privacy", "2 years"]] }),
  d("criteo", "Criteo", "Criteo", M, "Retargets visitors with product ads.", { urls: ["static.criteo.net", "criteo.net", "criteo.com"], cookies: [["cto_bundle", "13 months"], ["cto_bidid", "13 months"], ["cto_axid", "13 months"]] }),
  d("taboola", "Taboola", "Taboola", M, "Recommends sponsored content and measures conversions.", { urls: ["cdn.taboola.com", "trc.taboola.com", "taboola.com"], cookies: [["t_gid", "1 year"], ["t_pt_gid", "1 year"], ["taboola_usg", "1 year"]] }),
  d("outbrain", "Outbrain", "Outbrain", M, "Recommends sponsored content and measures conversions.", { urls: ["widgets.outbrain.com", "amplify.outbrain.com", "outbrain.com"], cookies: [["obuid", "3 months"], ["outbrain_cid_fetch", "5 minutes"]] }),
  d("quantcast", "Quantcast Measure", "Quantcast", M, "Measures audiences and targets ads.", { urls: ["quantserve.com", "quantcount.com"], cookies: [["__qca", "13 months"]] }),
  d("quantcast-choice", "Quantcast Choice", "Quantcast", E, "Consent management platform.", { urls: ["cmp.quantcast.com", "quantcast.mgr.consensu.org"], cookies: [["addtl_consent", "13 months"]] }),
  d("xandr", "Microsoft Xandr (AppNexus)", "Microsoft", M, "Ad exchange: buys and sells ad space.", { urls: ["adnxs.com"], cookies: [["uuid2", "3 months"], ["anj", "3 months"]] }),
  d("trade-desk", "The Trade Desk", "The Trade Desk", M, "Programmatic ad buying.", { urls: ["adsrvr.org"], cookies: [["TDID", "1 year"], ["TDCPM", "1 year"]] }),
  d("mediamath", "MediaMath", "MediaMath", M, "Programmatic ad buying.", { urls: ["mathtag.com"] }),
  d("magnite", "Magnite (Rubicon Project)", "Magnite", M, "Ad exchange.", { urls: ["rubiconproject.com"], cookies: [["khaos", "1 year"]] }),
  d("pubmatic", "PubMatic", "PubMatic", M, "Ad exchange.", { urls: ["pubmatic.com"], cookies: [["KADUSERCOOKIE", "3 months"]] }),
  d("openx", "OpenX", "OpenX", M, "Ad exchange.", { urls: ["openx.net"] }),
  d("index-exchange", "Index Exchange", "Index Exchange", M, "Ad exchange.", { urls: ["casalemedia.com", "indexww.com"], cookies: [["CMID", "1 year"]] }),
  d("sovrn", "Sovrn", "Sovrn", M, "Ad exchange and link monetisation.", { urls: ["lijit.com", "sovrn.com"], cookies: [["ljt_reader", "1 year"]] }),
  d("adroll", "AdRoll", "AdRoll", M, "Retargets visitors with ads.", { urls: ["s.adroll.com", "d.adroll.com"], cookies: [["__adroll", "13 months"], ["__adroll_fpc", "1 year"], ["__ar_v4", "1 year"]] }),
  d("mgid", "MGID", "MGID", M, "Native ads and sponsored content.", { urls: ["jsc.mgid.com", "mgid.com"] }),
  d("yahoo-dot", "Yahoo Ads (DOT)", "Yahoo", M, "Measures Yahoo ad conversions.", { urls: ["s.yimg.com/wi", "sp.analytics.yahoo.com", "s.yimg.com/rq"], cookies: [["A3", "1 year"]] }),
  d("lotame", "Lotame", "Lotame", M, "Builds audience profiles for ad targeting.", { urls: ["crwdcntrl.net"], cookies: [["_cc_id", "9 months"]] }),
  d("oracle-bluekai", "Oracle BlueKai", "Oracle", M, "Data management for ad targeting.", { urls: ["bluekai.com", "bkrtx.com"], cookies: [["bku", "6 months"], ["bkpa", "6 months"]] }),
  d("yandex-ads", "Yandex Advertising", "Yandex", M, "Serves Yandex ads.", { urls: ["an.yandex.ru", "yandex.ru/ads"] }),
  d("colombia", "Colombia (Times Internet)", "Times Internet", M, "Contextual and display ads (India).", { urls: ["static.clmbtech.com", "clmbtech.com"] }),
  d("inmobi", "InMobi", "InMobi", M, "Mobile and display ads.", { urls: ["inmobi.com", "inmobicdn.net"] }),
  d("vdo-ai", "VDO.AI", "VDO.AI", M, "Video ads.", { urls: ["a.vdo.ai", "vdo.ai"] }),
  d("branch", "Branch", "Branch", M, "Deep links and app-install attribution.", { urls: ["cdn.branch.io", "api2.branch.io"] }),
  d("appsflyer", "AppsFlyer", "AppsFlyer", M, "Attributes app installs to web campaigns.", { urls: ["websdk.appsflyer.com", "onelinksmartscript.appsflyer.com"], cookies: [["afUserId", "13 months"], ["AF_SYNC", "1 week"]] }),

  /* ---------------- Affiliate ---------------- */
  d("impact", "Impact", "impact.com", M, "Tracks affiliate referrals.", { urls: ["impactradius-event.com", "impact.com", "impactcdn.com"] }),
  d("awin", "Awin", "Awin", M, "Tracks affiliate referrals.", { urls: ["dwin1.com", "awin1.com"], cookies: [["_aw_m_*", "1 year"], ["_aw_sn_*", "1 year"]] }),
  d("cj-affiliate", "CJ Affiliate", "Commission Junction", M, "Tracks affiliate referrals.", { urls: ["emjcd.com", "cj.com"], cookies: [["cje", "13 months"]] }),
  d("shareasale", "ShareASale", "Awin", M, "Tracks affiliate referrals.", { urls: ["shareasale-analytics.com", "shareasale.com"] }),
  d("rakuten", "Rakuten Advertising", "Rakuten", M, "Tracks affiliate referrals.", { urls: ["linksynergy.com"] }),
  d("partnerize", "Partnerize", "Partnerize", M, "Tracks affiliate referrals.", { urls: ["prf.hn"] }),
  d("cuelinks", "Cuelinks", "Cuelinks", M, "Converts outbound links into affiliate links (India).", { urls: ["cdn0.cuelinks.com", "cuelinks.com"] }),

  /* ---------------- Product & web analytics ---------------- */
  d("hotjar", "Hotjar", "Contentsquare", A, "Records sessions, heatmaps and on-page surveys.", {
    urls: ["static.hotjar.com", "script.hotjar.com", "hotjar.com", "hotjar.io"],
    cookies: [["_hjSessionUser_*", "1 year"], ["_hjSession_*", "30 minutes"], ["_hjid", "1 year"], ["_hjAbsoluteSessionInProgress", "30 minutes"], ["_hjFirstSeen", "Session"], ["_hjIncludedInSessionSample*", "2 minutes"], ["_hjTLDTest", "Session"]],
    inline: ["_hjSettings"],
  }),
  d("contentsquare", "Contentsquare", "Contentsquare", A, "Analyses how visitors interact with pages.", { urls: ["t.contentsquare.net", "contentsquare.net"], cookies: [["_cs_id", "13 months"], ["_cs_s", "30 minutes"], ["_cs_c", "13 months"]] }),
  d("mixpanel", "Mixpanel", "Mixpanel", A, "Product analytics: events, funnels and retention.", { urls: ["cdn.mxpnl.com", "mixpanel.com", "mxpnl.net"], cookies: [["mp_*", "1 year"]], inline: ["mixpanel.init("] }),
  d("segment", "Segment", "Twilio", A, "Collects events and forwards them to other tools.", {
    urls: ["cdn.segment.com", "cdn.segment.io", "api.segment.io"],
    cookies: [["ajs_anonymous_id", "1 year"], ["ajs_user_id", "1 year"], ["ajs_group_id", "1 year"]],
    inline: ["analytics.load(\"", "analytics.load('"],
  }),
  d("rudderstack", "RudderStack", "RudderStack", A, "Collects events and forwards them to other tools.", { urls: ["cdn.rudderlabs.com", "rudderstack.com"], cookies: [["rl_*", "1 year"]] }),
  d("mparticle", "mParticle", "Rokt", A, "Collects events and forwards them to other tools.", { urls: ["jssdkcdns.mparticle.com", "mparticle.com"] }),
  d("amplitude", "Amplitude", "Amplitude", A, "Product analytics: events, funnels and retention.", { urls: ["cdn.amplitude.com", "api2.amplitude.com", "api.amplitude.com", "amplitude.com"], cookies: [["amp_*", "1 year"], ["AMP_*", "1 year"]] }),
  d("heap", "Heap", "Contentsquare", A, "Captures every click and page view for product analytics.", { urls: ["cdn.heapanalytics.com", "heapanalytics.com"], cookies: [["_hp2_id.*", "13 months"], ["_hp2_ses_props.*", "30 minutes"], ["_hp2_props.*", "13 months"]] }),
  d("fullstory", "FullStory", "FullStory", A, "Records sessions to replay how visitors use the site.", { urls: ["edge.fullstory.com", "rs.fullstory.com", "fullstory.com"], cookies: [["fs_uid", "1 year"], ["fs_lua", "30 minutes"], ["fs_cid", "1 year"]], inline: ["_fs_org", "window['_fs_host']"] }),
  d("posthog", "PostHog", "PostHog", A, "Product analytics and session replay.", { urls: ["i.posthog.com", "posthog.com"], cookies: [["ph_*", "1 year"]], inline: ["posthog.init("] }),
  d("matomo", "Matomo", "Matomo", A, "Web analytics, often self-hosted.", {
    urls: ["/matomo.js", "/piwik.js", "matomo.cloud", "/matomo.php", "/piwik.php"],
    cookies: [["_pk_id.*", "13 months"], ["_pk_ses.*", "30 minutes"], ["_pk_ref.*", "6 months"], ["_pk_cvar.*", "30 minutes"], ["MATOMO_SESSID", "Session"]],
    inline: ["_paq.push"],
  }),
  d("plausible", "Plausible Analytics", "Plausible", A, "Cookieless page-view counts.", { urls: ["plausible.io"] }),
  d("fathom", "Fathom Analytics", "Fathom", A, "Cookieless page-view counts.", { urls: ["cdn.usefathom.com", "usefathom.com"] }),
  d("simple-analytics", "Simple Analytics", "Simple Analytics", A, "Cookieless page-view counts.", { urls: ["scripts.simpleanalyticscdn.com", "simpleanalyticscdn.com", "simpleanalytics.com"] }),
  d("umami", "Umami", "Umami", A, "Cookieless page-view counts.", { urls: ["cloud.umami.is", "analytics.umami.is"] }),
  d("cloudflare-web-analytics", "Cloudflare Web Analytics", "Cloudflare", A, "Cookieless page-view and performance counts.", { urls: ["static.cloudflareinsights.com", "cloudflareinsights.com"] }),
  d("vercel-analytics", "Vercel Web Analytics", "Vercel", A, "Cookieless page-view counts.", { urls: ["/_vercel/insights", "va.vercel-scripts.com"] }),
  d("vercel-speed-insights", "Vercel Speed Insights", "Vercel", A, "Measures page speed (Core Web Vitals).", { urls: ["/_vercel/speed-insights"] }),
  d("adobe-analytics", "Adobe Analytics", "Adobe", A, "Measures visits and journeys.", {
    urls: ["sc.omtrdc.net", "2o7.net", "omtrdc.net"],
    cookies: [["s_cc", "Session"], ["s_sq", "Session"], ["s_vi", "2 years"], ["s_fid", "2 years"], ["s_ecid", "2 years"], ["s_ppv", "Session"]],
  }),
  d("adobe-ecid", "Adobe Experience Cloud ID", "Adobe", A, "Shared visitor ID across Adobe tools.", { urls: ["/VisitorAPI.js"], cookies: [["AMCV_*", "2 years"], ["AMCVS_*", "Session"]] }),
  d("adobe-launch", "Adobe Experience Platform Tags", "Adobe", E, "Loads the site's other tags (tag manager). The tags it loads are listed separately.", { urls: ["assets.adobedtm.com", "launch.adobe.com"] }),
  d("adobe-target", "Adobe Target", "Adobe", A, "A/B tests and personalises content.", { urls: ["tt.omtrdc.net"], cookies: [["mbox", "2 years"], ["at_check", "Session"]] }),
  d("adobe-audience-manager", "Adobe Audience Manager", "Adobe", M, "Builds audience segments for ads.", { urls: ["demdex.net"], cookies: [["demdex", "180 days"], ["dpm", "180 days"], ["dextp", "180 days"]] }),
  d("adobe-fonts", "Adobe Fonts", "Adobe", E, "Serves web fonts.", { urls: ["use.typekit.net", "p.typekit.net"] }),
  d("yandex-metrica", "Yandex Metrica", "Yandex", A, "Web analytics and session recording.", {
    urls: ["mc.yandex.ru", "mc.yandex.com", "mc.webvisor.org"],
    cookies: [["_ym_uid", "1 year"], ["_ym_d", "1 year"], ["_ym_isad", "2 days"], ["_ym_visorc", "30 minutes"], ["yandexuid", "1 year"]],
    inline: ["Ya.Metrika", "yandex_metrika_callbacks"],
  }),
  d("baidu-tongji", "Baidu Tongji", "Baidu", A, "Web analytics (China).", { urls: ["hm.baidu.com"], cookies: [["Hm_lvt_*", "1 year"], ["Hm_lpvt_*", "Session"], ["HMACCOUNT", "Session"]] }),
  d("optimizely", "Optimizely", "Optimizely", A, "A/B tests and personalises content.", { urls: ["cdn.optimizely.com", "optimizely.com"], cookies: [["optimizelyEndUserId", "6 months"]] }),
  d("vwo", "VWO", "Wingify", A, "A/B tests, heatmaps and session recording.", { urls: ["dev.visualwebsiteoptimizer.com", "visualwebsiteoptimizer.com", "vwo.com"], cookies: [["_vwo_uuid_v2", "1 year"], ["_vwo_uuid", "1 year"], ["_vis_opt_*", "100 days"], ["_vwo_*", "1 year"]] }),
  d("ab-tasty", "AB Tasty", "AB Tasty", A, "A/B tests and personalises content.", { urls: ["try.abtasty.com", "abtasty.com"], cookies: [["ABTasty", "13 months"], ["ABTastySession", "30 minutes"]] }),
  d("convert", "Convert Experiences", "Convert", A, "A/B tests.", { urls: ["convertexperiments.com"], cookies: [["_conv_v", "6 months"], ["_conv_s", "20 minutes"]] }),
  d("crazy-egg", "Crazy Egg", "Crazy Egg", A, "Heatmaps and session recording.", { urls: ["script.crazyegg.com", "crazyegg.com"], cookies: [["_ce.s", "1 year"], ["_ce.clock_data", "1 day"], ["_ce.clock_event", "1 day"]] }),
  d("mouseflow", "Mouseflow", "Mouseflow", A, "Heatmaps and session recording.", { urls: ["cdn.mouseflow.com", "mouseflow.com"], cookies: [["mf_*", "90 days"]] }),
  d("lucky-orange", "Lucky Orange", "Lucky Orange", A, "Heatmaps, session recording and chat.", { urls: ["luckyorange.com", "luckyorange.net"], cookies: [["_lo_uid", "1 year"], ["_lo_v", "1 year"]] }),
  d("smartlook", "Smartlook", "Cisco", A, "Session recording and event analytics.", { urls: ["web-sdk.smartlook.com", "rec.smartlook.com", "smartlook.com"], cookies: [["SL_C_*", "1 year"]] }),
  d("logrocket", "LogRocket", "LogRocket", A, "Session replay for debugging.", { urls: ["cdn.logrocket.io", "cdn.lr-ingest.io", "cdn.lr-in.com", "cdn.lr-in-prod.com", "logrocket.io"] }),
  d("inspectlet", "Inspectlet", "Inspectlet", A, "Session recording and heatmaps.", { urls: ["cdn.inspectlet.com"], cookies: [["__insp_*", "1 year"]] }),
  d("pendo", "Pendo", "Pendo", A, "Product analytics and in-app guides.", { urls: ["cdn.pendo.io", "pendo.io"], cookies: [["_pendo_*", "1 year"]] }),
  d("kissmetrics", "Kissmetrics", "Kissmetrics", A, "Customer analytics.", { urls: ["i.kissmetrics.io", "kissmetrics.io", "kissmetrics.com"], cookies: [["km_*", "5 years"]] }),
  d("woopra", "Woopra", "Appier", A, "Customer journey analytics.", { urls: ["static.woopra.com", "woopra.com"], cookies: [["wooTracker", "2 years"]] }),
  d("chartbeat", "Chartbeat", "Chartbeat", A, "Real-time audience analytics for publishers.", { urls: ["static.chartbeat.com", "chartbeat.com", "chartbeat.net"], cookies: [["_cb", "13 months"], ["_chartbeat2", "13 months"], ["_cb_svref", "30 minutes"]] }),
  d("comscore", "Comscore", "Comscore", A, "Audience measurement for media ratings.", { urls: ["sb.scorecardresearch.com", "scorecardresearch.com"], cookies: [["UIDR", "2 years"]] }),
  d("nielsen", "Nielsen", "Nielsen", A, "Audience measurement for media ratings.", { urls: ["imrworldwide.com"] }),
  d("piano-analytics", "Piano Analytics (AT Internet)", "Piano", A, "Web analytics for publishers.", { urls: ["tag.aticdn.net", "xiti.com"], cookies: [["atuserid", "13 months"], ["_pcid", "13 months"], ["_pctx", "13 months"]] }),
  d("snowplow", "Snowplow", "Snowplow", A, "Collects behavioural events.", { urls: ["snowplowanalytics.com"], cookies: [["_sp_id.*", "2 years"], ["_sp_ses.*", "30 minutes"]] }),
  d("statcounter", "StatCounter", "StatCounter", A, "Web analytics.", { urls: ["statcounter.com"], cookies: [["sc_is_visitor_unique", "2 years"]] }),
  d("clicky", "Clicky", "Clicky", A, "Real-time web analytics.", { urls: ["static.getclicky.com", "getclicky.com"], cookies: [["_jsuid", "1 year"], ["_first_pageview", "10 minutes"]] }),
  d("jetpack-stats", "Jetpack Stats", "Automattic", A, "WordPress site statistics.", { urls: ["stats.wp.com", "pixel.wp.com"], cookies: [["tk_ai", "Session"], ["tk_qs", "30 minutes"]] }),
  d("new-relic", "New Relic Browser", "New Relic", A, "Monitors page performance and errors.", { urls: ["js-agent.newrelic.com", "bam.nr-data.net", "bam-cell.nr-data.net"] }),
  d("datadog-rum", "Datadog RUM", "Datadog", A, "Monitors real visitors' page performance and errors.", { urls: ["datadoghq-browser-agent.com", "browser-intake-datadoghq.com", "browser-intake-datadoghq.eu"], cookies: [["_dd_s", "15 minutes"]] }),
  d("sentry", "Sentry", "Sentry", E, "Reports JavaScript errors so they can be fixed.", { urls: ["browser.sentry-cdn.com", "js.sentry-cdn.com", "ingest.sentry.io", "sentry.io"] }),
  d("qualtrics", "Qualtrics Site Intercept", "Qualtrics", A, "On-site surveys and feedback.", { urls: ["siteintercept.qualtrics.com", "qualtrics.com"], cookies: [["QSI_*", "Session"]] }),
  d("medallia", "Medallia Digital", "Medallia", A, "On-site surveys and feedback.", { urls: ["nebula-cdn.kampyle.com", "kampyle.com"], cookies: [["kampyle_userid", "1 year"], ["kampyleUserSession", "1 year"]] }),
  d("surveymonkey", "SurveyMonkey", "SurveyMonkey", F, "Embeds surveys.", { urls: ["widget.surveymonkey.com", "surveymonkey.com"] }),
  d("userpilot", "Userpilot", "Userpilot", A, "Product tours and usage analytics.", { urls: ["js.userpilot.io"] }),
  d("zoho-pagesense", "Zoho PageSense", "Zoho", A, "Heatmaps, A/B tests and funnels.", { urls: ["cdn.pagesense.io", "pagesense.io"] }),
  d("freshmarketer", "Freshmarketer", "Freshworks", A, "Heatmaps, A/B tests and session replay.", { urls: ["cdn.freshmarketer.com", "freshmarketer.com", "freshmarketer.in"], cookies: [["_fw_crm_v", "1 year"]] }),
  d("tealium", "Tealium iQ", "Tealium", E, "Loads the site's other tags (tag manager). The tags it loads are listed separately.", { urls: ["tags.tiqcdn.com", "tiqcdn.com"] }),
  d("tealium-visitor", "Tealium visitor ID", "Tealium", A, "Recognises returning visitors for Tealium tags.", { cookies: [["utag_main", "1 year"], ["utag_main_*", "1 year"]] }),
  d("naver-analytics", "Naver Analytics", "Naver", A, "Web analytics (Korea).", { urls: ["wcs.naver.net"] }),

  /* ---------------- Marketing automation & CRM ---------------- */
  d("hubspot", "HubSpot tracking", "HubSpot", M, "Tracks visits for HubSpot marketing and sales.", {
    urls: ["js.hs-scripts.com", "js.hs-analytics.net", "track.hubspot.com", "js.hsadspixel.net", "js.hs-ads.net"],
    cookies: [["hubspotutk", "6 months"], ["__hstc", "6 months"], ["__hssc", "30 minutes"], ["__hssrc", "Session"]],
  }),
  d("hubspot-forms", "HubSpot forms", "HubSpot", F, "Embeds HubSpot forms.", { urls: ["js.hsforms.net", "forms.hsforms.com", "hsforms.com"] }),
  d("hubspot-chat", "HubSpot chat", "HubSpot", F, "Live chat widget.", { urls: ["js.usemessages.com"], cookies: [["messagesUtk", "6 months"]] }),
  d("hubspot-banner", "HubSpot cookie banner", "HubSpot", E, "HubSpot's consent banner.", { urls: ["js.hs-banner.com"], cookies: [["__hs_opt_out", "6 months"], ["__hs_cookie_cat_pref", "6 months"], ["__hs_initial_opt_in", "7 days"]] }),
  d("marketo", "Marketo Munchkin", "Adobe", M, "Tracks visits for Marketo marketing automation.", { urls: ["munchkin.marketo.net", "mktoresp.com"], cookies: [["_mkto_trk", "2 years"]] }),
  d("pardot", "Salesforce Pardot", "Salesforce", M, "Tracks visits for Pardot marketing automation.", { urls: ["pi.pardot.com", "pardot.com"], cookies: [["visitor_id*", "1 year"], ["pi_opt_in*", "1 year"], ["lpv*", "30 minutes"]] }),
  d("salesforce-mc", "Salesforce Marketing Cloud", "Salesforce", M, "Email and journey marketing.", { urls: ["igodigital.com", "exacttarget.com", "marketingcloudapps.com"] }),
  d("eloqua", "Oracle Eloqua", "Oracle", M, "Tracks visits for Eloqua marketing automation.", { urls: ["eloqua.com", "en25.com"], cookies: [["ELOQUA", "13 months"], ["ELQSTATUS", "13 months"]] }),
  d("mailchimp", "Mailchimp", "Intuit", M, "Email sign-up forms and site tracking.", { urls: ["chimpstatic.com", "list-manage.com"], cookies: [["_mcid", "1 year"]] }),
  d("klaviyo", "Klaviyo", "Klaviyo", M, "Email and SMS marketing with on-site tracking.", { urls: ["static.klaviyo.com", "static-tracking.klaviyo.com", "klaviyo.com"], cookies: [["__kla_id", "2 years"]] }),
  d("brevo", "Brevo (Sendinblue)", "Brevo", M, "Email marketing and site tracking.", { urls: ["sibautomation.com", "sibforms.com", "conversations-widget.brevo.com"], cookies: [["sib_cuid", "6 months"]] }),
  d("activecampaign", "ActiveCampaign", "ActiveCampaign", M, "Email marketing and site tracking.", { urls: ["trackcmp.net", "activehosted.com"], cookies: [["prism_*", "1 month"]] }),
  d("drip", "Drip", "Drip", M, "Email marketing and site tracking.", { urls: ["tag.getdrip.com"], cookies: [["_drip_client_*", "2 years"]] }),
  d("convertkit", "Kit (ConvertKit)", "Kit", M, "Email sign-up forms.", { urls: ["f.convertkit.com", "convertkit.com"] }),
  d("mailerlite", "MailerLite", "MailerLite", M, "Email sign-up forms.", { urls: ["assets.mailerlite.com", "static.mailerlite.com"] }),
  d("omnisend", "Omnisend", "Omnisend", M, "Email and SMS marketing for shops.", { urls: ["omnisnippet1.com", "omnisrc.com"], cookies: [["omnisendSessionID", "30 minutes"]] }),
  d("privy", "Privy", "Attentive", M, "Pop-ups and email capture.", { urls: ["widget.privy.com"] }),
  d("optinmonster", "OptinMonster", "Awesome Motive", M, "Pop-ups and email capture.", { urls: ["a.omappapi.com", "omappapi.com"], cookies: [["omVisits", "Session"], ["_omappvp", "11 years"], ["_omappvs", "20 minutes"]] }),
  d("sumo", "Sumo", "Sumo", M, "Pop-ups, share buttons and email capture.", { urls: ["load.sumo.com", "sumo.com"] }),
  d("customer-io", "Customer.io", "Customer.io", M, "Messaging and behavioural tracking.", { urls: ["assets.customer.io", "track.customer.io"] }),
  d("braze", "Braze", "Braze", M, "Messaging and engagement.", { urls: ["js.appboycdn.com", "braze.com"] }),
  d("onesignal", "OneSignal", "OneSignal", M, "Web push notifications.", { urls: ["cdn.onesignal.com", "onesignal.com"] }),
  d("izooto", "iZooto", "iZooto", M, "Web push notifications (India).", { urls: ["cdn.izooto.com", "izooto.com"] }),
  d("moengage", "MoEngage", "MoEngage", M, "Customer engagement: push, email and on-site messages.", { urls: ["cdn.moengage.com", "moengage.com"] }),
  d("clevertap", "CleverTap", "CleverTap", M, "Customer engagement and retention analytics.", { urls: ["static.clevertap.com", "clevertap-prod.com", "clevertap.com"], cookies: [["WZRK_G", "1 year"], ["WZRK_S_*", "20 minutes"]] }),
  d("webengage", "WebEngage", "WebEngage", M, "Customer engagement: push, email and on-site messages.", { urls: ["widgets.in.webengage.com", "ssl.widgets.webengage.com", "webengage.com", "webengage.co"] }),
  d("netcore", "Netcore Smartech", "Netcore Cloud", M, "Customer engagement and web push (India).", { urls: ["cdnt.netcoresmartech.com", "netcoresmartech.com"] }),
  d("leadfeeder", "Dealfront (Leadfeeder)", "Dealfront", M, "Identifies companies that visit the site.", { urls: ["lftracker.leadfeeder.com", "sc.lfeeder.com"], cookies: [["_lfa", "2 years"]] }),
  d("clearbit", "Clearbit Reveal", "HubSpot", M, "Identifies companies that visit the site.", { urls: ["tag.clearbitscripts.com", "clearbit.com"] }),
  d("6sense", "6sense", "6sense", M, "Identifies companies that visit the site for B2B ads.", { urls: ["j.6sc.co", "6sc.co"], cookies: [["_gd_visitor", "13 months"], ["_gd_session", "4 hours"], ["_gd_svisitor", "13 months"]] }),
  d("zoominfo", "ZoomInfo WebSights", "ZoomInfo", M, "Identifies companies that visit the site.", { urls: ["ws.zoominfo.com", "js.zi-scripts.com"] }),
  d("bombora", "Bombora", "Bombora", M, "B2B intent data for ad targeting.", { urls: ["ml314.com"] }),
  d("demandbase", "Demandbase", "Demandbase", M, "Account-based marketing and ads.", { urls: ["tag.demandbase.com", "demandbase.com"] }),
  d("apollo", "Apollo website visitors", "Apollo.io", M, "Identifies companies that visit the site.", { urls: ["assets.apollo.io"] }),

  /* ---------------- Chat & support ---------------- */
  d("intercom", "Intercom", "Intercom", F, "Live chat and help centre widget.", {
    urls: ["widget.intercom.io", "js.intercomcdn.com", "api-iam.intercom.io"],
    cookies: [["intercom-id-*", "9 months"], ["intercom-session-*", "1 week"], ["intercom-device-id-*", "9 months"]],
    inline: ["intercomSettings"],
  }),
  d("drift", "Drift", "Salesloft", F, "Live chat and chatbots.", { urls: ["js.driftt.com", "drift.com"], cookies: [["driftt_aid", "2 years"], ["drift_aid", "2 years"], ["drift_campaign_refresh", "30 minutes"]] }),
  d("zendesk", "Zendesk widget", "Zendesk", F, "Live chat and help centre widget.", { urls: ["static.zdassets.com", "zopim.com", "zendesk.com/embeddable"], cookies: [["__zlcmid", "1 year"], ["ZD-suid", "1 year"], ["ZD-buid", "1 year"]] }),
  d("crisp", "Crisp", "Crisp", F, "Live chat widget.", { urls: ["client.crisp.chat", "crisp.chat"], cookies: [["crisp-client/*", "6 months"]], inline: ["CRISP_WEBSITE_ID"] }),
  d("tawk", "tawk.to", "tawk.to", F, "Live chat widget.", { urls: ["embed.tawk.to", "tawk.to"], cookies: [["TawkConnectionTime", "Session"], ["twk_uuid_*", "6 months"], ["twk_idm_key", "Session"]], inline: ["Tawk_API"] }),
  d("livechat", "LiveChat", "Text", F, "Live chat widget.", { urls: ["cdn.livechatinc.com", "livechatinc.com"], cookies: [["__lc_cid", "2 years"], ["__lc_cst", "2 years"]] }),
  d("olark", "Olark", "Olark", F, "Live chat widget.", { urls: ["static.olark.com", "olark.com"], cookies: [["hblid", "2 years"], ["olfsk", "2 years"]] }),
  d("tidio", "Tidio", "Tidio", F, "Live chat and chatbots.", { urls: ["code.tidio.co", "tidio.co"] }),
  d("gorgias", "Gorgias chat", "Gorgias", F, "Live chat for shops.", { urls: ["config.gorgias.chat", "gorgias.chat"] }),
  d("helpscout", "Help Scout Beacon", "Help Scout", F, "Help centre and chat widget.", { urls: ["beacon-v2.helpscout.net"] }),
  d("zoho-salesiq", "Zoho SalesIQ", "Zoho", F, "Live chat and visitor tracking.", {
    urls: ["salesiq.zoho.com", "salesiq.zoho.in", "salesiq.zoho.eu", "salesiq.zohopublic.com", "salesiq.zohopublic.in"],
    cookies: [["_zldp", "2 years"], ["_zldt", "1 day"], ["LS_CSRF_TOKEN", "Session"]],
    inline: ["$zoho.salesiq"],
  }),
  d("zoho-forms", "Zoho Forms", "Zoho", F, "Embeds Zoho forms.", { urls: ["forms.zohopublic.com", "forms.zohopublic.in", "forms.zoho.com"] }),
  d("zoho-crm", "Zoho CRM web forms", "Zoho", F, "Sends form entries to Zoho CRM.", { urls: ["crm.zoho.com", "crm.zoho.in", "crm.zohopublic.com"], cookies: [["zc_consent", "1 year"], ["zc_show", "1 year"]] }),
  d("freshchat", "Freshchat", "Freshworks", F, "Live chat widget.", { urls: ["wchat.freshchat.com", "wchat.in.freshchat.com", "freshchat.com"] }),
  d("freshdesk", "Freshdesk widget", "Freshworks", F, "Help centre widget.", { urls: ["widget.freshworks.com", "euc-widget.freshworks.com", "ind-widget.freshworks.com"] }),
  d("freshsales", "Freshsales tracking", "Freshworks", M, "Tracks visits for Freshworks CRM.", { urls: ["freshsales.io", "myfreshworks.com/crm"], cookies: [["fs_cid", "1 year"]] }),
  d("haptik", "Haptik", "Jio Haptik", F, "Chatbot (India).", { urls: ["toolassets.haptikapi.com", "haptikapi.com"] }),
  d("yellow-ai", "Yellow.ai", "Yellow.ai", F, "Chatbot.", { urls: ["cdn.yellowmessenger.com", "yellowmessenger.com"] }),
  d("calendly", "Calendly", "Calendly", F, "Embeds meeting booking.", { urls: ["assets.calendly.com", "calendly.com"] }),
  d("typeform", "Typeform", "Typeform", F, "Embeds forms and surveys.", { urls: ["embed.typeform.com", "form.typeform.com"] }),
  d("jotform", "Jotform", "Jotform", F, "Embeds forms.", { urls: ["form.jotform.com", "cdn.jotfor.ms", "jotform.com"] }),
  d("appcues", "Appcues", "Appcues", F, "Product tours and onboarding.", { urls: ["fast.appcues.com"] }),
  d("walkme", "WalkMe", "WalkMe", F, "Guided walkthroughs.", { urls: ["cdn.walkme.com"] }),
  d("userway", "UserWay", "UserWay", F, "Accessibility widget.", { urls: ["cdn.userway.org"] }),
  d("accessibe", "accessiBe", "accessiBe", F, "Accessibility widget.", { urls: ["acsbapp.com", "acsbap.com"] }),

  /* ---------------- Media & social embeds ---------------- */
  d("vimeo", "Vimeo", "Vimeo", A, "Plays embedded videos and counts views.", { urls: ["player.vimeo.com", "vimeocdn.com", "vimeo.com"], cookies: [["vuid", "2 years"]] }),
  d("wistia", "Wistia", "Wistia", A, "Plays embedded videos and measures engagement.", { urls: ["fast.wistia.com", "fast.wistia.net", "wistia.com"] }),
  d("loom", "Loom", "Atlassian", F, "Plays embedded screen recordings.", { urls: ["loom.com/embed"] }),
  d("spotify", "Spotify embed", "Spotify", F, "Plays embedded music and podcasts.", { urls: ["open.spotify.com/embed"] }),
  d("soundcloud", "SoundCloud", "SoundCloud", F, "Plays embedded audio.", { urls: ["w.soundcloud.com"] }),
  d("twitch", "Twitch embed", "Amazon", F, "Plays embedded streams.", { urls: ["player.twitch.tv", "embed.twitch.tv"] }),
  d("dailymotion", "Dailymotion", "Dailymotion", M, "Plays embedded videos with ads.", { urls: ["geo.dailymotion.com", "dailymotion.com/embed"] }),
  d("jw-player", "JW Player", "JWP", F, "Plays embedded videos.", { urls: ["jwpcdn.com", "jwplayer.com", "jwpltx.com"] }),
  d("brightcove", "Brightcove", "Brightcove", F, "Plays embedded videos.", { urls: ["players.brightcove.net"] }),
  d("disqus", "Disqus", "Disqus", M, "Comments, with ads and tracking.", { urls: ["disqus.com", "disquscdn.com"] }),
  d("addthis", "AddThis", "Oracle", M, "Share buttons (discontinued by Oracle in 2023).", { urls: ["s7.addthis.com", "addthis.com"], cookies: [["__atuvc", "13 months"], ["__atuvs", "30 minutes"]] }),
  d("sharethis", "ShareThis", "ShareThis", M, "Share buttons that also collect audience data.", { urls: ["platform-api.sharethis.com", "sharethis.com"], cookies: [["__stid", "2 years"], ["__sharethis_cookie_test__", "Session"]] }),
  d("addtoany", "AddToAny", "AddToAny", F, "Share buttons.", { urls: ["static.addtoany.com"] }),
  d("trustpilot", "Trustpilot widget", "Trustpilot", F, "Shows reviews.", { urls: ["widget.trustpilot.com"] }),
  d("yotpo", "Yotpo", "Yotpo", F, "Shows reviews and loyalty programmes.", { urls: ["staticw2.yotpo.com", "cdn-widgetsrepository.yotpo.com", "yotpo.com"] }),
  d("judge-me", "Judge.me", "Judge.me", F, "Shows product reviews.", { urls: ["judge.me", "judgeme.imgix.net"] }),
  d("elfsight", "Elfsight widgets", "Elfsight", F, "Social feeds, reviews and other widgets.", { urls: ["apps.elfsight.com", "elfsightcdn.com", "static.elfsight.com"] }),

  /* ---------------- Payments (essential) ---------------- */
  d("stripe", "Stripe", "Stripe", E, "Processes payments and prevents fraud.", { urls: ["js.stripe.com", "m.stripe.network", "checkout.stripe.com", "m.stripe.com"], cookies: [["__stripe_mid", "1 year"], ["__stripe_sid", "30 minutes"]] }),
  d("paypal", "PayPal", "PayPal", E, "Processes payments.", { urls: ["paypal.com/sdk", "paypalobjects.com", "paypal.com/tagmanager"], cookies: [["ts_c", "3 years"], ["tsrce", "3 days"], ["x-pp-s", "Session"]] }),
  d("razorpay", "Razorpay", "Razorpay", E, "Processes payments (India).", { urls: ["checkout.razorpay.com", "cdn.razorpay.com", "razorpay.com"] }),
  d("paytm", "Paytm Payment Gateway", "Paytm", E, "Processes payments (India).", { urls: ["securegw.paytm.in", "securegw-stage.paytm.in", "paytm.in", "paytm.com"] }),
  d("phonepe", "PhonePe", "PhonePe", E, "Processes payments (India).", { urls: ["mercury.phonepe.com", "phonepe.com"] }),
  d("cashfree", "Cashfree", "Cashfree", E, "Processes payments (India).", { urls: ["sdk.cashfree.com", "cashfree.com"] }),
  d("payu", "PayU", "PayU", E, "Processes payments.", { urls: ["payu.in", "payumoney.com", "jssdk.payu.in"] }),
  d("juspay", "Juspay", "Juspay", E, "Processes payments (India).", { urls: ["juspay.in"] }),
  d("braintree", "Braintree", "PayPal", E, "Processes payments.", { urls: ["js.braintreegateway.com", "braintreegateway.com"] }),
  d("square", "Square", "Block", E, "Processes payments.", { urls: ["web.squarecdn.com", "squareup.com"] }),
  d("adyen", "Adyen", "Adyen", E, "Processes payments.", { urls: ["checkoutshopper-live.adyen.com", "adyen.com"] }),
  d("apple-pay", "Apple Pay", "Apple", E, "Processes payments.", { urls: ["applepay.cdn-apple.com"] }),
  d("klarna", "Klarna", "Klarna", F, "Pay-later checkout and on-site messages.", { urls: ["x.klarnacdn.net", "klarnaservices.com", "klarna.com"] }),

  /* ---------------- Security, hosting & consent (essential) ---------------- */
  d("cloudflare-bot", "Cloudflare bot management", "Cloudflare", E, "Protects the site from bots and abuse.", {
    urls: ["/cdn-cgi/challenge-platform"],
    cookies: [["__cf_bm", "30 minutes"], ["cf_clearance", "1 year"], ["_cfuvid", "Session"], ["__cflb", "1 day"], ["cf_chl_*", "Session"], ["__cfruid", "Session"]],
  }),
  d("cloudflare-turnstile", "Cloudflare Turnstile", "Cloudflare", E, "Tells people from bots on forms.", { urls: ["challenges.cloudflare.com"] }),
  d("cloudflare-cdnjs", "cdnjs", "Cloudflare", E, "Serves open-source code libraries.", { urls: ["cdnjs.cloudflare.com"] }),
  d("cloudflare-email", "Cloudflare email protection", "Cloudflare", E, "Hides email addresses from scrapers.", { urls: ["/cdn-cgi/scripts"] }),
  d("hcaptcha", "hCaptcha", "Intuition Machines", E, "Tells people from bots on forms.", { urls: ["js.hcaptcha.com", "hcaptcha.com"], cookies: [["hmt_id", "1 year"]] }),
  d("akamai-bot", "Akamai Bot Manager", "Akamai", E, "Protects the site from bots and abuse.", { urls: ["/akam/"], cookies: [["_abck", "1 year"], ["bm_sz", "4 hours"], ["ak_bmsc", "2 hours"], ["bm_sv", "2 hours"], ["bm_mi", "2 hours"]] }),
  d("imperva", "Imperva (Incapsula)", "Imperva", E, "Protects the site from bots and attacks.", { urls: ["/_Incapsula_Resource"], cookies: [["visid_incap_*", "1 year"], ["incap_ses_*", "Session"], ["nlbi_*", "Session"], ["reese84", "30 days"]] }),
  d("aws-elb", "AWS load balancer", "Amazon Web Services", E, "Keeps a visitor on the same server.", { cookies: [["AWSALB", "7 days"], ["AWSALBCORS", "7 days"], ["AWSALBTG", "7 days"], ["AWSALBTGCORS", "7 days"], ["AWSELB", "Session"]] }),
  d("jsdelivr", "jsDelivr", "jsDelivr", E, "Serves open-source code libraries.", { urls: ["cdn.jsdelivr.net", "fastly.jsdelivr.net"] }),
  d("unpkg", "unpkg", "unpkg", E, "Serves open-source code libraries.", { urls: ["unpkg.com"] }),
  d("jquery-cdn", "jQuery CDN", "OpenJS Foundation", E, "Serves the jQuery library.", { urls: ["code.jquery.com"] }),
  d("bootstrap-cdn", "BootstrapCDN", "jsDelivr", E, "Serves the Bootstrap library.", { urls: ["stackpath.bootstrapcdn.com", "maxcdn.bootstrapcdn.com", "netdna.bootstrapcdn.com"] }),
  d("font-awesome", "Font Awesome", "Fonticons", E, "Serves icon fonts.", { urls: ["kit.fontawesome.com", "use.fontawesome.com", "ka-f.fontawesome.com"] }),
  d("plain-theory", "Plain Theory consent", "Plain Theory", E, "Shows the consent banner and remembers the visitor's choice.", { urls: ["/sdk/plain-consent.js"], cookies: [["plain_consent", "6 months"]] }),
  d("onetrust", "OneTrust", "OneTrust", E, "Consent management platform.", { urls: ["cdn.cookielaw.org", "optanon.blob.core.windows.net", "cookie-cdn.cookiepro.com"], cookies: [["OptanonConsent", "1 year"], ["OptanonAlertBoxClosed", "1 year"]] }),
  d("cookiebot", "Cookiebot", "Usercentrics", E, "Consent management platform.", { urls: ["consent.cookiebot.com", "consentcdn.cookiebot.com"], cookies: [["CookieConsent", "1 year"]] }),
  d("cookieyes", "CookieYes", "CookieYes", E, "Consent management platform.", { urls: ["cdn-cookieyes.com"], cookies: [["cookieyes-consent", "1 year"]] }),
  d("didomi", "Didomi", "Didomi", E, "Consent management platform.", { urls: ["sdk.privacy-center.org"], cookies: [["didomi_token", "1 year"], ["euconsent-v2", "1 year"]] }),
  d("termly", "Termly", "Termly", E, "Consent management platform.", { urls: ["app.termly.io"] }),
  d("usercentrics", "Usercentrics", "Usercentrics", E, "Consent management platform.", { urls: ["app.usercentrics.eu", "web.cmp.usercentrics.eu"] }),
  d("osano", "Osano", "Osano", E, "Consent management platform.", { urls: ["cmp.osano.com"], cookies: [["osano_consentmanager", "1 year"], ["osano_consentmanager_uuid", "1 year"]] }),
  d("trustarc", "TrustArc", "TrustArc", E, "Consent management platform.", { urls: ["consent.trustarc.com"], cookies: [["notice_preferences", "13 months"], ["notice_gdpr_prefs", "13 months"]] }),
  d("iubenda", "iubenda", "iubenda", E, "Consent management platform.", { urls: ["cdn.iubenda.com", "cs.iubenda.com"], cookies: [["_iub_cs-*", "1 year"]] }),
  d("complianz", "Complianz", "Complianz", E, "Consent management plugin for WordPress.", { cookies: [["cmplz_*", "1 year"]] }),
  d("cookie-notice", "Cookie Notice (WordPress)", "Hu-manity.co", E, "Consent banner plugin for WordPress.", { cookies: [["cookie_notice_accepted", "1 month"]] }),

  /* ---------------- Platforms & frameworks (session cookies) ---------------- */
  d("shopify", "Shopify storefront", "Shopify", E, "Runs the shop: cart, checkout and sign-in.", {
    urls: ["cdn.shopify.com", "shopifycdn.net"],
    cookies: [["cart", "2 weeks"], ["cart_sig", "2 weeks"], ["cart_ts", "2 weeks"], ["cart_currency", "2 weeks"], ["secure_customer_sig", "1 year"], ["_tracking_consent", "1 year"], ["localization", "2 weeks"], ["keep_alive", "30 minutes"], ["_cmp_a", "1 day"], ["_secure_session_id", "1 day"], ["_shopify_essential", "1 year"]],
  }),
  d("shopify-analytics", "Shopify analytics", "Shopify", A, "Shop analytics: visits, sources and sales.", {
    urls: ["monorail-edge.shopifysvc.com", "/.well-known/shopify/monorail"],
    cookies: [["_shopify_y", "1 year"], ["_shopify_s", "30 minutes"], ["_orig_referrer", "2 weeks"], ["_landing_page", "2 weeks"], ["_shopify_sa_t", "30 minutes"], ["_shopify_sa_p", "30 minutes"], ["_shopify_analytics", "1 year"]],
  }),
  d("wordpress", "WordPress", "WordPress", E, "Runs the site and keeps editors signed in.", {
    urls: ["/wp-includes/", "/wp-content/", "/wp-json/"],
    cookies: [["wordpress_logged_in_*", "Session"], ["wordpress_sec_*", "Session"], ["wordpress_test_cookie", "Session"], ["wp_lang", "Session"]],
  }),
  d("wordpress-settings", "WordPress preferences", "WordPress", F, "Remembers editor and commenter settings.", { cookies: [["wp-settings-*", "1 year"], ["wp-settings-time-*", "1 year"], ["comment_author_*", "347 days"]] }),
  d("woocommerce", "WooCommerce", "Automattic", E, "Runs the shop's cart and checkout.", { cookies: [["woocommerce_cart_hash", "Session"], ["woocommerce_items_in_cart", "Session"], ["wp_woocommerce_session_*", "2 days"], ["woocommerce_recently_viewed", "Session"]] }),
  d("woocommerce-attribution", "WooCommerce order attribution", "Automattic", A, "Records which source led to each order.", { cookies: [["sbjs_*", "Session"]] }),
  d("wix", "Wix", "Wix", E, "Runs the site.", { urls: ["static.parastorage.com", "static.wixstatic.com"], cookies: [["svSession", "2 years"], ["XSRF-TOKEN", "Session"], ["bSession", "30 minutes"], ["ssr-caching", "Session"]] }),
  d("squarespace", "Squarespace", "Squarespace", E, "Runs the site.", { urls: ["static1.squarespace.com", "assets.squarespace.com"], cookies: [["crumb", "Session"], ["SS_MID", "2 years"]] }),
  d("squarespace-analytics", "Squarespace analytics", "Squarespace", A, "Site analytics.", { cookies: [["ss_cvr", "2 years"], ["ss_cvt", "30 minutes"], ["ss_cid", "2 years"], ["ss_cpvisit", "2 years"]] }),
  d("webflow", "Webflow", "Webflow", E, "Runs the site.", { urls: ["cdn.prod.website-files.com", "assets.website-files.com", "assets-global.website-files.com"] }),
  d("magento", "Adobe Commerce (Magento)", "Adobe", E, "Runs the shop's cart and sign-in.", { cookies: [["form_key", "1 day"], ["mage-cache-sessid", "Session"], ["mage-cache-storage", "Session"], ["mage-messages", "1 year"], ["private_content_version", "1 year"], ["X-Magento-Vary", "Session"]] }),
  d("php-session", "PHP session", "Site", E, "Keeps the visitor's session on the server.", { cookies: [["PHPSESSID", "Session"]] }),
  d("java-session", "Java session", "Site", E, "Keeps the visitor's session on the server.", { cookies: [["JSESSIONID", "Session"]] }),
  d("aspnet-session", "ASP.NET session", "Site", E, "Keeps the visitor's session on the server.", { cookies: [["ASP.NET_SessionId", "Session"], [".AspNetCore.*", "Session"], ["ARRAffinity", "Session"], ["ARRAffinitySameSite", "Session"]] }),
  d("node-session", "Node.js session", "Site", E, "Keeps the visitor's session on the server.", { cookies: [["connect.sid", "Session"]] }),
  d("laravel-session", "Laravel session", "Site", E, "Keeps the visitor's session on the server.", { cookies: [["laravel_session", "2 hours"]] }),
  d("django-session", "Django session", "Site", E, "Keeps the visitor's session and protects forms.", { cookies: [["sessionid", "2 weeks"], ["csrftoken", "1 year"]] }),
  d("csrf", "Form protection", "Site", E, "Protects forms against cross-site request forgery.", { cookies: [["XSRF-TOKEN", "Session"], ["_csrf", "Session"], ["csrf_token", "Session"], ["__Host-csrf*", "Session"]] }),
  d("nextauth", "Auth.js session", "Site", E, "Keeps visitors signed in.", { cookies: [["next-auth.session-token", "30 days"], ["__Secure-next-auth.session-token", "30 days"], ["authjs.session-token", "30 days"], ["__Secure-authjs.session-token", "30 days"], ["next-auth.csrf-token", "Session"], ["authjs.csrf-token", "Session"]] }),
  d("vercel-protection", "Vercel deployment protection", "Vercel", E, "Lets reviewers see protected previews.", { cookies: [["_vercel_jwt", "1 hour"], ["_vcrcs", "1 hour"]] }),
  d("locale", "Language preference", "Site", F, "Remembers the visitor's language.", { cookies: [["NEXT_LOCALE", "1 year"], ["locale", "1 year"], ["pll_language", "1 year"], ["wp-wpml_current_language", "1 day"]] }),
];

/* ---------------- matching ---------------- */

interface UrlRule {
  pattern: string;
  host?: string;
  path?: string;
  def: TrackerDef;
}

const URL_RULES: UrlRule[] = TRACKER_DB.flatMap((def) =>
  (def.urls ?? []).map((pattern) => {
    const p = pattern.toLowerCase();
    if (p.startsWith("/")) return { pattern, path: p, def };
    const slash = p.indexOf("/");
    return slash === -1 ? { pattern, host: p, def } : { pattern, host: p.slice(0, slash), path: p.slice(slash), def };
  }),
).sort((a, b) => b.pattern.length - a.pattern.length);

const hostMatches = (host: string, rule: string) => host === rule || host.endsWith(`.${rule}`);

/** Does one URL pattern (as written in the DB, or a customer's own) match a host and path? */
export function urlPatternMatches(pattern: string, host: string, pathAndQuery: string): boolean {
  const p = pattern.toLowerCase();
  const h = host.toLowerCase();
  const path = pathAndQuery.toLowerCase();
  if (p.startsWith("/")) return path.includes(p);
  const slash = p.indexOf("/");
  if (slash === -1) return hostMatches(h, p);
  return hostMatches(h, p.slice(0, slash)) && path.startsWith(p.slice(slash));
}

function toUrl(raw: string | URL): URL | null {
  if (raw instanceof URL) return raw;
  try {
    return new URL(raw.startsWith("//") ? `https:${raw}` : raw);
  } catch {
    return null;
  }
}

export interface UrlMatch {
  def: TrackerDef;
  /** the DB pattern that matched */
  matched: string;
}

/** The most specific tracker for a script, iframe or image address, or null. */
export function matchUrl(raw: string | URL): UrlMatch | null {
  const u = toUrl(raw);
  if (!u || !/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  const path = `${u.pathname}${u.search}`.toLowerCase();
  for (const r of URL_RULES) {
    if (r.host && !hostMatches(host, r.host)) continue;
    if (r.path && (r.host ? !path.startsWith(r.path) : !path.includes(r.path))) continue;
    return { def: r.def, matched: r.pattern };
  }
  return null;
}

interface CookieRule {
  name: string;
  expiry: string;
  re: RegExp;
  /** literal characters: more is more specific */
  weight: number;
  def: TrackerDef;
}

const esc = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
const COOKIE_RULES: CookieRule[] = TRACKER_DB.flatMap((def) =>
  (def.cookies ?? []).map(([name, expiry]) => ({
    name,
    expiry,
    re: new RegExp(`^${name.split("*").map(esc).join(".*")}$`),
    weight: name.replace(/\*/g, "").length + (name.includes("*") ? 0 : 1000),
    def,
  })),
).sort((a, b) => b.weight - a.weight);

export interface CookieMatch {
  def: TrackerDef;
  /** the DB cookie pattern that matched, e.g. "_ga_*" */
  matched: string;
  expiry: string;
}

/** The tracker a cookie name belongs to, or null. Names are case-sensitive, as in browsers. */
export function matchCookie(name: string): CookieMatch | null {
  const n = name.trim();
  if (!n) return null;
  const r = COOKIE_RULES.find((c) => c.re.test(n));
  return r ? { def: r.def, matched: r.name, expiry: r.expiry } : null;
}

/** Trackers whose snippet signature appears in inline script code. */
export function matchInline(code: string): TrackerDef[] {
  if (!code) return [];
  return TRACKER_DB.filter((def) => def.inline?.some((s) => code.includes(s)));
}

export function trackerById(id: string): TrackerDef | undefined {
  return TRACKER_DB.find((t) => t.id === id);
}

/** The pattern the SDK holds for a tracker: its first URL pattern. */
export const primaryPattern = (def: TrackerDef) => def.urls?.[0];
