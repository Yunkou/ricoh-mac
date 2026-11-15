//! Local mock GR camera HTTP server for development and UI testing.

use nsh_app_ricoh_mac::mock_camera::{MockConfig, MockServer};

fn main() {
    let mut bind = "127.0.0.1:8080".to_string();
    let mut count: usize = 2;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--count" {
            let value = args.next().expect("--count requires a number");
            count = value.parse().expect("--count must be a positive integer");
        } else if let Some(value) = arg.strip_prefix("--count=") {
            count = value.parse().expect("--count must be a positive integer");
        } else if arg.starts_with('-') {
            panic!("Unknown argument: {arg}");
        } else {
            bind = arg;
        }
    }
    let server =
        MockServer::bind(&bind, MockConfig::with_file_count(count)).expect("bind mock camera");
    println!("Mock GR camera listening at {}", server.base_url());
    println!("Serving {count} photos. Set the app camera address in Settings to this origin.");
    println!("This fixture is for development only; it is not a real camera.");
    println!("Press Ctrl+C to stop.");
    loop {
        std::thread::park();
    }
}
