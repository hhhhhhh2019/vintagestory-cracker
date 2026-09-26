{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
  flake-utils.lib.eachDefaultSystem(system: let
    pkgs = import nixpkgs { inherit system; };

    server = pkgs.stdenv.mkDerivation {
      pname = "server";
      version = "1";
      nativeBuildInputs = with pkgs; [
        nodejs
        openssl
      ];
    };
  in {
    packages = {
      inherit server;
    };
    devShells = {};
  });
}
