//! Secret storage for camera Wi-Fi passwords.
//!
//! Production uses the macOS Keychain. Tests use an in-memory store. Passwords
//! are never written to `data_dir` or log output.

#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::Mutex;

use crate::error::AppError;

const SERVICE: &str = "com.yunkou.ricoh-mac.camera-wifi";

/// A store for profile Wi-Fi passwords.
pub trait SecretStore {
    fn set_secret(&self, account: &str, secret: &str) -> Result<(), AppError>;
    fn get_secret(&self, account: &str) -> Result<Option<String>, AppError>;
    fn delete_secret(&self, account: &str) -> Result<(), AppError>;
}

/// In-memory store used by tests.
#[cfg(test)]
#[derive(Default)]
pub struct MemorySecrets {
    values: Mutex<HashMap<String, String>>,
}

#[cfg(test)]
#[cfg(test)]
impl SecretStore for MemorySecrets {
    fn set_secret(&self, account: &str, secret: &str) -> Result<(), AppError> {
        self.values
            .lock()
            .map_err(|err| AppError::msg(err.to_string()))?
            .insert(account.to_string(), secret.to_string());
        Ok(())
    }

    fn get_secret(&self, account: &str) -> Result<Option<String>, AppError> {
        Ok(self
            .values
            .lock()
            .map_err(|err| AppError::msg(err.to_string()))?
            .get(account)
            .cloned())
    }

    fn delete_secret(&self, account: &str) -> Result<(), AppError> {
        self.values
            .lock()
            .map_err(|err| AppError::msg(err.to_string()))?
            .remove(account);
        Ok(())
    }
}

/// macOS Keychain, using the generic password API without a keychain-access group
/// so an ad hoc signed personal app can use it.
pub struct MacKeychain {
    service: String,
}

impl Default for MacKeychain {
    fn default() -> Self {
        Self {
            service: SERVICE.to_string(),
        }
    }
}

impl SecretStore for MacKeychain {
    fn set_secret(&self, account: &str, secret: &str) -> Result<(), AppError> {
        #[cfg(target_os = "macos")]
        {
            // Replace any previous item so an edited password is stored.
            let _ = security_framework::passwords::delete_generic_password(&self.service, account);
            security_framework::passwords::set_generic_password(
                &self.service,
                account,
                secret.as_bytes(),
            )
            .map_err(|_err| AppError::msg("无法把密码存入钥匙串。"))
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (account, secret);
            Err(AppError::msg("钥匙串仅在 macOS 上可用"))
        }
    }

    fn get_secret(&self, account: &str) -> Result<Option<String>, AppError> {
        #[cfg(target_os = "macos")]
        {
            match security_framework::passwords::get_generic_password(&self.service, account) {
                Ok(bytes) => String::from_utf8(bytes)
                    .map(Some)
                    .map_err(|_err| AppError::msg("钥匙串中的密码无法读取，请重新输入。")),
                Err(err) => {
                    let text = err.to_string();
                    if text.contains("could not be found")
                        || text.contains("errSecItemNotFound")
                        || text.contains("-25300")
                    {
                        Ok(None)
                    } else {
                        Err(AppError::msg("无法从钥匙串读取密码。"))
                    }
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = account;
            Err(AppError::msg("钥匙串仅在 macOS 上可用"))
        }
    }

    fn delete_secret(&self, account: &str) -> Result<(), AppError> {
        #[cfg(target_os = "macos")]
        {
            match security_framework::passwords::delete_generic_password(&self.service, account) {
                Ok(()) => Ok(()),
                Err(err) => {
                    let text = err.to_string();
                    if text.contains("could not be found")
                        || text.contains("errSecItemNotFound")
                        || text.contains("-25300")
                    {
                        Ok(())
                    } else {
                        Err(AppError::msg("无法从钥匙串删除密码。"))
                    }
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = account;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{MemorySecrets, SecretStore};

    #[test]
    fn memory_store_round_trips_and_deletes() {
        let store = MemorySecrets::default();
        store.set_secret("cam-1", "secret").unwrap();
        assert_eq!(
            store.get_secret("cam-1").unwrap().as_deref(),
            Some("secret")
        );
        store.set_secret("cam-1", "new").unwrap();
        assert_eq!(store.get_secret("cam-1").unwrap().as_deref(), Some("new"));
        store.delete_secret("cam-1").unwrap();
        assert_eq!(store.get_secret("cam-1").unwrap(), None);
        store.delete_secret("missing").unwrap();
    }
}
