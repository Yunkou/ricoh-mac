#import <CoreGraphics/CoreGraphics.h>
#import <CoreImage/CoreImage.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

#include "ricoh_raw.h"

#include <stdlib.h>
#include <string.h>

static void set_error(char *err, size_t err_len, const char *message) {
  if (err == NULL || err_len == 0) {
    return;
  }
  if (message == NULL) {
    err[0] = '\0';
    return;
  }
  strncpy(err, message, err_len - 1);
  err[err_len - 1] = '\0';
}

static NSData *jpeg_data_from_image(CGImageRef image) {
  if (image == NULL) {
    return nil;
  }
  NSMutableData *data = [NSMutableData data];
  CGImageDestinationRef dest =
      CGImageDestinationCreateWithData((__bridge CFMutableDataRef)data, CFSTR("public.jpeg"), 1, NULL);
  if (dest == NULL) {
    return nil;
  }
  NSDictionary *options = @{
    (id)kCGImageDestinationLossyCompressionQuality : @0.86,
  };
  CGImageDestinationAddImage(dest, image, (__bridge CFDictionaryRef)options);
  BOOL ok = CGImageDestinationFinalize(dest);
  CFRelease(dest);
  return ok ? data : nil;
}

int32_t ricoh_raw_develop_dng(
    const char *path,
    uint32_t max_long_edge,
    RicohRawJpeg *out,
    char *err,
    size_t err_len) {
  if (out != NULL) {
    memset(out, 0, sizeof(*out));
  }
  if (path == NULL || path[0] == '\0' || out == NULL) {
    set_error(err, err_len, "missing path or output buffer");
    return RICOH_RAW_ERR;
  }

  if (@available(macOS 12.0, *)) {
    @autoreleasepool {
      NSString *pathString = [NSString stringWithUTF8String:path];
      if (pathString == nil) {
        set_error(err, err_len, "path is not valid UTF-8");
        return RICOH_RAW_ERR;
      }
      NSURL *url = [NSURL fileURLWithPath:pathString];
      CIRAWFilter *filter = [CIRAWFilter filterWithImageURL:url];
      if (filter == nil) {
        set_error(err, err_len, "CIRAWFilter rejected the file");
        return RICOH_RAW_ERR;
      }

      CGSize native = filter.nativeSize;
      float longest = (float)MAX(native.width, native.height);
      if (longest <= 0.0f) {
        set_error(err, err_len, "CIRAWFilter reported an empty native size");
        return RICOH_RAW_ERR;
      }
      float scale = 1.0f;
      if (max_long_edge > 0 && longest > (float)max_long_edge) {
        scale = (float)max_long_edge / longest;
      }
      if (scale < 0.0f) {
        scale = 0.0f;
      } else if (scale > 1.0f) {
        scale = 1.0f;
      }
      filter.scaleFactor = scale;
      filter.extendedDynamicRangeAmount = 0.0f;
      filter.draftModeEnabled = NO;

      // PreviewImage is an auxiliary embedded JPEG. It is not a sensor develop.
      CIImage *image = filter.outputImage;
      if (image == nil) {
        set_error(err, err_len, "CIRAWFilter.outputImage was empty");
        return RICOH_RAW_ERR;
      }

      CGColorSpaceRef colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
      if (colorSpace == NULL) {
        set_error(err, err_len, "could not create an sRGB color space");
        return RICOH_RAW_ERR;
      }
      CIContext *context = [CIContext contextWithOptions:nil];
      CGImageRef cgImage = [context createCGImage:image
                                         fromRect:image.extent
                                           format:kCIFormatRGBA8
                                       colorSpace:colorSpace];
      CGColorSpaceRelease(colorSpace);
      if (cgImage == NULL) {
        set_error(err, err_len, "CIContext failed to render outputImage");
        return RICOH_RAW_ERR;
      }

      size_t width = CGImageGetWidth(cgImage);
      size_t height = CGImageGetHeight(cgImage);
      NSData *jpeg = jpeg_data_from_image(cgImage);
      CGImageRelease(cgImage);
      if (jpeg == nil || jpeg.length == 0) {
        set_error(err, err_len, "could not encode the developed image as JPEG");
        return RICOH_RAW_ERR;
      }

      uint8_t *copy = (uint8_t *)malloc(jpeg.length);
      if (copy == NULL) {
        set_error(err, err_len, "out of memory");
        return RICOH_RAW_ERR;
      }
      memcpy(copy, jpeg.bytes, jpeg.length);
      out->bytes = copy;
      out->len = jpeg.length;
      out->width = (uint32_t)width;
      out->height = (uint32_t)height;
      set_error(err, err_len, NULL);
      return RICOH_RAW_OK;
    }
  }

  set_error(err, err_len, "CIRAWFilter requires macOS 12 or later");
  return RICOH_RAW_UNSUPPORTED;
}

void ricoh_raw_jpeg_free(RicohRawJpeg *image) {
  if (image == NULL) {
    return;
  }
  if (image->bytes != NULL) {
    free(image->bytes);
  }
  memset(image, 0, sizeof(*image));
}
