#ifndef RICOH_RAW_H
#define RICOH_RAW_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

enum {
  RICOH_RAW_OK = 0,
  RICOH_RAW_ERR = 1,
  RICOH_RAW_UNSUPPORTED = 2
};

typedef struct RicohRawJpeg {
  uint8_t *bytes;
  size_t len;
  uint32_t width;
  uint32_t height;
} RicohRawJpeg;

/// Develop a DNG (or other camera RAW) file with Core Image CIRAWFilter.
///
/// This must use CIRAWFilter.outputImage, never CIRAWFilter.previewImage and
/// never CGImageSource as the decode path. The result is an sRGB JPEG.
/// `max_long_edge` of 0 means the native unscaled long edge.
/// The caller frees a successful result with ricoh_raw_jpeg_free.
int32_t ricoh_raw_develop_dng(
    const char *path,
    uint32_t max_long_edge,
    RicohRawJpeg *out,
    char *err,
    size_t err_len);

void ricoh_raw_jpeg_free(RicohRawJpeg *image);

#ifdef __cplusplus
}
#endif

#endif
