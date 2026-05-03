{pkgs}: {
  deps = [
    pkgs.libffi
    pkgs.glib
    pkgs.harfbuzz
    pkgs.gobject-introspection
    pkgs.pkg-config
    pkgs.pango
    pkgs.cairo
    pkgs.ffmpeg
  ];
}
