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
  ];

  opencode = {
    enable = true;
  };

  claude.code = {
    enable = true;

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
