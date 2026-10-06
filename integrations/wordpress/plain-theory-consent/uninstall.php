<?php
/**
 * Removes the plugin's settings when it's deleted from the Plugins screen.
 * Consent records live in your Plain Theory account, not in WordPress, so nothing else is stored here.
 *
 * @package PlainTheoryConsent
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'ptc_settings' );

if ( is_multisite() ) {
	delete_site_option( 'ptc_settings' );
}
