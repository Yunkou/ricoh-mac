fn main() {
    println!("cargo:rerun-if-changed=native/ricoh_raw.m");
    println!("cargo:rerun-if-changed=native/ricoh_raw.h");
    println!("cargo:rerun-if-changed=build.rs");

    if std::env::var("CARGO_CFG_TARGET_OS").ok().as_deref() != Some("macos") {
        return;
    }

    cc::Build::new()
        .file("native/ricoh_raw.m")
        .flag("-fobjc-arc")
        .flag("-fmodules")
        .include("native")
        .compile("ricoh_raw");

    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rustc-link-lib=framework=CoreFoundation");
    println!("cargo:rustc-link-lib=framework=CoreGraphics");
    println!("cargo:rustc-link-lib=framework=CoreImage");
    println!("cargo:rustc-link-lib=framework=ImageIO");
}
