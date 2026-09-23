// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//! The origin, and what the window is allowed to navigate to.
//!
//! Both matter more than their size suggests: the origin is what every contact
//! on the machine is keyed to, and the navigation guard is the whole of this
//! shell's security policy.

use contacts_shell::config::{app_origin, is_internal_url, start_url, APP_HOST, APP_SCHEME};

/// The two desktop webviews spell a registered scheme differently, and the
/// shell has to hand each one the origin it actually granted.
#[test]
fn each_platform_gets_the_origin_it_grants() {
    assert_eq!(app_origin(false), "contacts://localhost");
    assert_eq!(app_origin(true), "http://contacts.localhost");
}

/// Not a tautology: these two words are what every stored contact is keyed to,
/// so a rename is a migration rather than a tidy-up. The test is here to make
/// that cost visible to whoever changes them.
#[test]
fn the_origin_is_built_from_the_two_constants() {
    assert_eq!(APP_SCHEME, "contacts");
    assert_eq!(APP_HOST, "localhost");
}

#[test]
fn the_window_opens_on_the_entry_page() {
    assert_eq!(
        start_url("contacts://localhost"),
        "contacts://localhost/index.html"
    );
    // A trailing slash on the origin must not become a double one.
    assert_eq!(
        start_url("contacts://localhost/"),
        "contacts://localhost/index.html"
    );
}

#[test]
fn our_own_pages_navigate_in_the_window() {
    let origin = "contacts://localhost";
    assert!(is_internal_url("contacts://localhost", origin, None));
    assert!(is_internal_url(
        "contacts://localhost/index.html",
        origin,
        None
    ));
    assert!(is_internal_url(
        "contacts://localhost/privacy/",
        origin,
        None
    ));
}

/// Everything else opens in the user's browser rather than replacing the app
/// with a web page it cannot leave.
#[test]
fn anything_else_does_not() {
    let origin = "contacts://localhost";
    for outside in [
        "https://github.com/niclaslindstedt/contacts",
        "https://contacts.niclaslindstedt.se/",
        "file:///etc/passwd",
        // The near-miss that a naive `starts_with` on the scheme would admit.
        "contacts://localhost.example.com/",
    ] {
        assert!(
            !is_internal_url(outside, origin, None),
            "{outside} was treated as our own page"
        );
    }
}

/// A launch pointed at a remote build (`CONTACTS_APP_URL`) navigates within THAT
/// site too — otherwise every in-app link would bounce to the browser.
#[test]
fn a_remote_launch_navigates_within_its_own_site() {
    let origin = "contacts://localhost";
    let remote = Some("https://contacts.niclaslindstedt.se/preview/");
    assert!(is_internal_url(
        "https://contacts.niclaslindstedt.se/preview/index.html",
        origin,
        remote
    ));
    assert!(!is_internal_url("https://example.com/", origin, remote));
    // An empty override is not an override.
    assert!(!is_internal_url("https://example.com/", origin, Some("")));
}
