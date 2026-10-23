#!/usr/bin/env perl
use strict;
use warnings;
use Compress::Zlib qw(compress crc32);

my @sizes = (16, 32, 48, 128);
for my $size (@sizes) {
  my $scale = 4;
  my $samples = $scale * $scale;
  my $raw = '';
  for my $y (0 .. $size - 1) {
    $raw .= "\0";
    for my $x (0 .. $size - 1) {
      my ($red, $green, $blue, $alpha) = (0, 0, 0, 0);
      for my $sy (0 .. $scale - 1) {
        for my $sx (0 .. $scale - 1) {
          my $px = ($x + ($sx + .5) / $scale) * 128 / $size;
          my $py = ($y + ($sy + .5) / $scale) * 128 / $size;
          my ($r, $g, $b, $a) = paint($px, $py);
          $red += $r * $a;
          $green += $g * $a;
          $blue += $b * $a;
          $alpha += $a;
        }
      }
      my $opacity = $alpha / $samples;
      my $unpremultiply = $alpha ? 1 / $alpha : 0;
      $raw .= pack('C4', map { int($_ + .5) } (
        $red * $unpremultiply,
        $green * $unpremultiply,
        $blue * $unpremultiply,
        255 * $opacity,
      ));
    }
  }
  write_png("icon$size.png", $size, $size, $raw);
}

sub paint {
  my ($x, $y) = @_;
  return (0, 0, 0, 0) unless rounded_rect($x, $y, 8, 8, 112, 112, 30);
  my $mix = (($x - 8) + ($y - 8)) / 224;
  my @colour = (109 * (1 - $mix) + 79 * $mix, 108 * (1 - $mix) + 80 * $mix, 232 * (1 - $mix) + 201 * $mix, 1);
  return (255, 255, 255, 1) if ring($x, $y, 64, 64, 32, 3);
  return (255, 255, 255, 1) if segment($x, $y, 54, 27, 74, 27, 3);
  return (255, 255, 255, 1) if segment($x, $y, 64, 27, 64, 35, 3);
  return (255, 255, 255, 1) if segment($x, $y, 64, 45, 64, 66, 3);
  return (255, 255, 255, 1) if segment($x, $y, 64, 66, 78, 75, 3);
  return (255, 255, 255, 1) if circle($x, $y, 64, 64, 4);
  return @colour;
}

sub rounded_rect {
  my ($x, $y, $left, $top, $width, $height, $radius) = @_;
  my $cx = $x < $left + $radius ? $left + $radius : $x > $left + $width - $radius ? $left + $width - $radius : $x;
  my $cy = $y < $top + $radius ? $top + $radius : $y > $top + $height - $radius ? $top + $height - $radius : $y;
  return (($x - $cx) ** 2 + ($y - $cy) ** 2) <= $radius ** 2;
}

sub circle { my ($x, $y, $cx, $cy, $radius) = @_; return ($x - $cx) ** 2 + ($y - $cy) ** 2 <= $radius ** 2; }
sub ring { my ($x, $y, $cx, $cy, $radius, $half_width) = @_; my $distance = sqrt(($x - $cx) ** 2 + ($y - $cy) ** 2); return abs($distance - $radius) <= $half_width; }
sub segment {
  my ($x, $y, $x1, $y1, $x2, $y2, $radius) = @_;
  my ($dx, $dy) = ($x2 - $x1, $y2 - $y1);
  my $length_squared = $dx * $dx + $dy * $dy;
  my $t = $length_squared ? (($x - $x1) * $dx + ($y - $y1) * $dy) / $length_squared : 0;
  $t = 0 if $t < 0; $t = 1 if $t > 1;
  return circle($x, $y, $x1 + $dx * $t, $y1 + $dy * $t, $radius);
}

sub chunk { my ($type, $data) = @_; return pack('N', length $data) . $type . $data . pack('N', crc32($type . $data)); }
sub write_png {
  my ($path, $width, $height, $pixels) = @_;
  open my $file, '>:raw', $path or die "Unable to write $path: $!";
  print {$file} "\x89PNG\x0d\x0a\x1a\x0a";
  print {$file} chunk('IHDR', pack('NNC5', $width, $height, 8, 6, 0, 0, 0));
  print {$file} chunk('IDAT', compress($pixels));
  print {$file} chunk('IEND', '');
  close $file;
}
