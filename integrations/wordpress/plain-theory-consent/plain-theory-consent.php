<?php
/**
 * Plugin Name:       Plain Theory Consent
 * Plugin URI:        https://theplaintheory.in/docs#wordpress
 * Description:       Adds the Plain Theory consent script to your site: trackers wait until visitors choose, the right notice shows for GDPR, CCPA/CPRA and India's DPDPA, and every decision is recorded.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            The Plain Theory
 * Author URI:        https://theplaintheory.in
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       plain-theory-consent
 *
 * @package PlainTheoryConsent
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const PTC_OPTION       = 'ptc_settings';
const PTC_DEFAULT_SRC  = 'https://cdn.theplaintheory.in/sdk/v1/plain-consent.js';
const PTC_CATEGORIES   = array( 'functional', 'analytics', 'marketing' );

/**
 * Settings with defaults. Stored as one option so uninstall removes everything at once.
 *
 * @return array{site_key:string,api_url:string,config_url:string,load_first:bool,held:array<string,string>}
 */
function ptc_settings() {
	$defaults = array(
		'site_key'   => '',
		'api_url'    => '',
		'config_url' => '',
		'load_first' => true,
		// script handle => category, e.g. "google-analytics" => "analytics".
		'held'       => array(),
	);
	$saved = get_option( PTC_OPTION, array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
}

/**
 * Print the consent script. Runs at priority 0 on wp_head when "Load before other scripts" is on,
 * because a tracker that's already in the page before the script runs can't be held.
 */
function ptc_print_script() {
	$s = ptc_settings();
	if ( '' === $s['site_key'] || is_admin() ) {
		return;
	}
	$src = PTC_DEFAULT_SRC;
	if ( '' !== $s['api_url'] ) {
		// Self-hosted or regional deployments serve the script next to the API.
		$parts = wp_parse_url( $s['api_url'] );
		if ( ! empty( $parts['scheme'] ) && ! empty( $parts['host'] ) ) {
			$port = isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '';
			$src  = $parts['scheme'] . '://' . $parts['host'] . $port . '/sdk/plain-consent.js';
		}
	}

	$attrs = array(
		'src'       => $src,
		'data-site' => $s['site_key'],
	);
	if ( '' !== $s['api_url'] ) {
		$attrs['data-api'] = $s['api_url'];
	}
	if ( '' !== $s['config_url'] ) {
		$attrs['data-config-url'] = $s['config_url'];
	}

	$html = '';
	foreach ( $attrs as $name => $value ) {
		$html .= sprintf( ' %s="%s"', esc_attr( $name ), 'src' === $name ? esc_url( $value ) : esc_attr( $value ) );
	}
	// Deliberately not async/defer: the consent script must run before any tracker in the page.
	echo '<script' . $html . '></script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- attributes escaped above.
}

add_action(
	'init',
	static function () {
		$s = ptc_settings();
		add_action( 'wp_head', 'ptc_print_script', $s['load_first'] ? 0 : 10 );
	}
);

/**
 * Hold scripts registered by other plugins (by handle) until their category is consented to.
 * The consent script releases tags marked type="text/plain" data-consent="<category>".
 *
 * @param string $tag    The full script tag.
 * @param string $handle The registered handle.
 * @return string
 */
function ptc_hold_script_tag( $tag, $handle ) {
	$held = ptc_settings()['held'];
	if ( empty( $held[ $handle ] ) || ! in_array( $held[ $handle ], PTC_CATEGORIES, true ) ) {
		return $tag;
	}
	$category = $held[ $handle ];
	// Replace an existing type attribute, or add one, then mark the category.
	if ( preg_match( '/\stype=("|\')[^"\']*\1/i', $tag ) ) {
		$tag = preg_replace( '/\stype=("|\')[^"\']*\1/i', ' type="text/plain"', $tag, 1 );
	} else {
		$tag = preg_replace( '/<script\b/i', '<script type="text/plain"', $tag, 1 );
	}
	return preg_replace( '/<script\b/i', '<script data-consent="' . esc_attr( $category ) . '"', $tag, 1 );
}
add_filter( 'script_loader_tag', 'ptc_hold_script_tag', 10, 2 );

/* ---------------------------------------------------------------- Settings */

add_action(
	'admin_menu',
	static function () {
		add_options_page(
			__( 'Plain Theory Consent', 'plain-theory-consent' ),
			__( 'Plain Theory', 'plain-theory-consent' ),
			'manage_options',
			'plain-theory-consent',
			'ptc_render_settings_page'
		);
	}
);

add_action(
	'admin_init',
	static function () {
		register_setting(
			'ptc',
			PTC_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => 'ptc_sanitize',
				'default'           => array(),
			)
		);
	}
);

/**
 * Validate everything that comes back from the settings form.
 *
 * @param mixed $input Raw form input.
 * @return array
 */
function ptc_sanitize( $input ) {
	$input = is_array( $input ) ? $input : array();
	$out   = ptc_settings();

	$key = isset( $input['site_key'] ) ? sanitize_text_field( wp_unslash( $input['site_key'] ) ) : '';
	if ( '' !== $key && ! preg_match( '/^pk_[A-Za-z0-9_-]{4,64}$/', $key ) ) {
		add_settings_error( PTC_OPTION, 'ptc_site_key', __( 'The site key should look like pk_ followed by letters and numbers. Copy it from Install in your Plain Theory dashboard.', 'plain-theory-consent' ) );
	} else {
		$out['site_key'] = $key;
	}

	foreach ( array( 'api_url', 'config_url' ) as $field ) {
		$raw = isset( $input[ $field ] ) ? trim( wp_unslash( $input[ $field ] ) ) : '';
		if ( '' === $raw ) {
			$out[ $field ] = '';
			continue;
		}
		$url = esc_url_raw( $raw, array( 'https', 'http' ) );
		if ( '' === $url || ( 0 !== strpos( $url, 'https://' ) && false === strpos( $url, '://localhost' ) ) ) {
			add_settings_error( PTC_OPTION, 'ptc_' . $field, __( 'Use an https:// address for the API and config URLs.', 'plain-theory-consent' ) );
			continue;
		}
		$out[ $field ] = untrailingslashit( $url );
	}

	$out['load_first'] = ! empty( $input['load_first'] );

	// One handle per line: "handle = category".
	$held  = array();
	$lines = isset( $input['held'] ) ? preg_split( '/\r\n|\r|\n/', wp_unslash( $input['held'] ) ) : array();
	foreach ( (array) $lines as $line ) {
		$line = trim( $line );
		if ( '' === $line ) {
			continue;
		}
		$pair     = array_map( 'trim', explode( '=', $line, 2 ) );
		$handle   = sanitize_key( $pair[0] );
		$category = isset( $pair[1] ) ? sanitize_key( $pair[1] ) : '';
		if ( '' === $handle || ! in_array( $category, PTC_CATEGORIES, true ) ) {
			/* translators: %s: the line the user entered. */
			add_settings_error( PTC_OPTION, 'ptc_held', sprintf( __( 'Skipped "%s". Use handle = analytics, marketing or functional.', 'plain-theory-consent' ), esc_html( $line ) ) );
			continue;
		}
		$held[ $handle ] = $category;
	}
	$out['held'] = $held;

	return $out;
}

/** Settings → Plain Theory. */
function ptc_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$s         = ptc_settings();
	$held_text = '';
	foreach ( $s['held'] as $handle => $category ) {
		$held_text .= $handle . ' = ' . $category . "\n";
	}
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Plain Theory Consent', 'plain-theory-consent' ); ?></h1>
		<p><?php esc_html_e( 'Paste your site key from Install in the Plain Theory dashboard. The banner, regions and languages are set up there.', 'plain-theory-consent' ); ?></p>
		<?php settings_errors( PTC_OPTION ); ?>
		<form action="options.php" method="post">
			<?php settings_fields( 'ptc' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="ptc_site_key"><?php esc_html_e( 'Site key', 'plain-theory-consent' ); ?></label></th>
					<td>
						<input name="<?php echo esc_attr( PTC_OPTION ); ?>[site_key]" id="ptc_site_key" type="text" class="regular-text code" value="<?php echo esc_attr( $s['site_key'] ); ?>" placeholder="pk_live_..." autocomplete="off" />
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Load order', 'plain-theory-consent' ); ?></th>
					<td>
						<label>
							<input name="<?php echo esc_attr( PTC_OPTION ); ?>[load_first]" type="checkbox" value="1" <?php checked( $s['load_first'] ); ?> />
							<?php esc_html_e( 'Load before other scripts (recommended)', 'plain-theory-consent' ); ?>
						</label>
						<p class="description"><?php esc_html_e( 'Trackers that run before the consent script can\'t be held. Leave this on unless another plugin must load first.', 'plain-theory-consent' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="ptc_held"><?php esc_html_e( 'Hold these scripts', 'plain-theory-consent' ); ?></label></th>
					<td>
						<textarea name="<?php echo esc_attr( PTC_OPTION ); ?>[held]" id="ptc_held" rows="5" class="large-text code" placeholder="google-analytics = analytics&#10;facebook-pixel = marketing"><?php echo esc_textarea( $held_text ); ?></textarea>
						<p class="description"><?php esc_html_e( 'Scripts added by other plugins, by their WordPress handle, one per line. Each waits until the visitor allows its category: analytics, marketing or functional. Known trackers are held automatically.', 'plain-theory-consent' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="ptc_api_url"><?php esc_html_e( 'API URL', 'plain-theory-consent' ); ?></label></th>
					<td>
						<input name="<?php echo esc_attr( PTC_OPTION ); ?>[api_url]" id="ptc_api_url" type="url" class="regular-text code" value="<?php echo esc_attr( $s['api_url'] ); ?>" placeholder="https://app.theplaintheory.in/api/v1" />
						<p class="description"><?php esc_html_e( 'Optional. Only for self-hosted or dedicated-region deployments.', 'plain-theory-consent' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="ptc_config_url"><?php esc_html_e( 'Config URL', 'plain-theory-consent' ); ?></label></th>
					<td>
						<input name="<?php echo esc_attr( PTC_OPTION ); ?>[config_url]" id="ptc_config_url" type="url" class="regular-text code" value="<?php echo esc_attr( $s['config_url'] ); ?>" />
						<p class="description"><?php esc_html_e( 'Optional. Leave empty to use the default.', 'plain-theory-consent' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button( __( 'Save settings', 'plain-theory-consent' ) ); ?>
		</form>
	</div>
	<?php
}

/** Settings link on the Plugins screen. */
add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	static function ( $links ) {
		$url = admin_url( 'options-general.php?page=plain-theory-consent' );
		array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'plain-theory-consent' ) . '</a>' );
		return $links;
	}
);
