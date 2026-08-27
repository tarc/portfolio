{ ... }:
{
  programs = {
    cmake-format.enable = true;
    alejandra.enable = false;
    nixfmt.enable = true;
    deadnix = {
      enable = true;
      no-lambda-pattern-names = true;
      no-lambda-arg = true;
    };
    mdformat.enable = true;
    just.enable = true;
  };
}
