{
  config,
  pkgs,
  ...
}:
let
  args = [ "mcp" ];
  command = "devenv";
  cwd = config.devenv.root;
  DEVENV_ROOT = cwd;
  env = {
    inherit DEVENV_ROOT;
  };
in
{
  name = "portfolio";

  languages = {
    javascript = {
      enable = true;
      npm.enable = true;
      npm.install.enable = true;
      pnpm.enable = true;
    };
  };

  packages = with pkgs; [
    deno
    imagemagick
    jq
    just
    tea
  ];

  opencode = {
    enable = true;
  };

  files.".codex/config.toml".toml = {
    mcp_servers.devenv = {
      inherit
        args
        command
        cwd
        env
        ;
    };
  };

  claude.code = {
    enable = true;

    skills.browser-check = {
      description = "Screenshot pages of the site in a headless Windows Edge from WSL2, in light and dark and at desktop or phone width, optionally one element with its computed styles or after a click, check the site's layout rules on every page at phone, tablet and desktop widths, and compare every page with a reference set of screenshots. Use to see how a page looks after any visual change (layout, colours, borders, components, dark mode) instead of inferring it from the code or asking the user for screenshots, to confirm the change broke no layout rule, and to see everything a change altered across the site.";
      content = builtins.readFile ./scripts/browser-check/skill.md;
    };

    mcpServers = {
      # Local devenv MCP server
      devenv = {
        inherit args command env;
        type = "stdio";
      };
    };

    permissions = {
      rules = {
        WebFetch = {
          allow = [
            "domain:github.com"
            "domain:docs.anthropic.com"
            "domain:nendi-candra.vercel.app"
            "domain:tarcisio.codeberg.page"
            "domain:codeberg.org"
            "domain:codeberg.page"
            "domain:woodpecker-ci.org"
            "domain:cdn.simpleicons.org"
          ];
        };
        Bash = {
          allow = [
            "nix search:*"
            "nix-instantiate:*"
            "git:*"
            "jq:*"
            "devenv shell -- npx astro:*"
            "devenv shell -- astro dev:*"
            "devenv shell -- just:*"
            "curl:*"
          ];
        };
      };
    };
  };

  treefmt = {
    enable = false;
    config = ./treefmt.nix;
  };
}
