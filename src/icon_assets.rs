use std::fs;
use std::path::PathBuf;

fn icons_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui/assets/icons")
}

#[test]
fn interface_icons_use_the_official_color_variant_and_on_accent_icons_stay_monochrome() {
    let mut names: Vec<String> = fs::read_dir(icons_dir())
        .unwrap()
        .filter_map(|entry| {
            let name = entry.unwrap().file_name().to_string_lossy().into_owned();
            name.ends_with(".svg").then_some(name)
        })
        .collect();
    names.sort();
    assert_eq!(names.len(), 27);

    let on_accent: Vec<&str> = names
        .iter()
        .filter(|name| name.ends_with("-on-accent.svg"))
        .map(String::as_str)
        .collect();
    assert_eq!(
        on_accent,
        [
            "download-on-accent.svg",
            "folder-plus-on-accent.svg",
            "wifi-on-accent.svg",
        ]
    );

    for name in &names {
        let svg = fs::read_to_string(icons_dir().join(name)).unwrap();
        if name.ends_with("-on-accent.svg") {
            assert!(
                svg.contains("-soft"),
                "{name} should stay on the monochrome soft variant"
            );
        } else {
            assert!(
                !svg.contains("-soft"),
                "{name} should use the official color variant"
            );
        }
    }
}
