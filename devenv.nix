{
  config,
  pkgs,
  ...
}:
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
    jq
    just
    tea
  ];

  opencode = {
    enable = true;
  };

  claude.code = {
    enable = true;

    skills.browser-check = {
      description = "Screenshot pages of the site in a headless Windows Edge from WSL2, in light and dark and at desktop or phone width, optionally one element with its computed styles or after a click, and check the site's layout rules on every page at phone, tablet and desktop widths. Use to see how a page looks after any visual change (layout, colours, borders, components, dark mode) instead of inferring it from the code or asking the user for screenshots, and to confirm the change broke no layout rule.";
      content = builtins.readFile ./scripts/browser-check/skill.md;
    };

    mcpServers = {
      # Local devenv MCP server
      devenv = {
        type = "stdio";
        command = "devenv";
        args = [ "mcp" ];
        env = {
          DEVENV_ROOT = config.devenv.root;
        };
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
