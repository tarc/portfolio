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
      pnpm.enable = true;
    };
  };

  packages = with pkgs; [
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
          ];
        };
        Bash = {
          allow = [
            "nix search:*"
            "nix-instantiate:*"
            "git:*"
            "jq:*"
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
