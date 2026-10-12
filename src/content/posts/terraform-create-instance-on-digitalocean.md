---
title: "terraform create instance on digitalocean"
description: "Install terraform apt-get update apt-get install -y gnupg software-properties-common curl curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor"
pubDatetime: 2025-12-19T07:32:00Z
tags: []
draft: false
---

<h3 id="install-terraform">Install terraform</h3>

<pre><span></span>apt-get update
apt-get install -y gnupg software-properties-common curl

curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list

apt-get update
apt-get install terraform
</pre>



<p>创建和销毁实例</p>

<pre><span></span>terraform init
terraform apply
terraform destroy
</pre>



<h3 id="usage">Usage</h3>

<pre><span></span>Usage: terraform [global options] &lt;subcommand&gt; [args]

The available commands for execution are listed below.
The primary workflow commands are given first, followed by
less common or more advanced commands.

Main commands:
  init          Prepare your working directory for other commands
  validate      Check whether the configuration is valid
  plan          Show changes required by the current configuration
  apply         Create or update infrastructure
  destroy       Destroy previously-created infrastructure

All other commands:
  console       Try Terraform expressions at an interactive command prompt
  fmt           Reformat your configuration in the standard style
  force-unlock  Release a stuck lock on the current workspace
  get           Install or upgrade remote Terraform modules
  graph         Generate a Graphviz graph of the steps in an operation
  import        Associate existing infrastructure with a Terraform resource
  login         Obtain and save credentials for a remote host
  logout        Remove locally-stored credentials for a remote host
  metadata      Metadata related commands
  modules       Show all declared modules in a working directory
  output        Show output values from your root module
  providers     Show the providers required for this configuration
  query         Search and list remote infrastructure with Terraform
  refresh       Update the state to match remote systems
  show          Show the current state or a saved plan
  stacks        Manage HCP Terraform stack operations
  state         Advanced state management
  taint         Mark a resource instance as not fully functional
  test          Execute integration tests for Terraform modules
  untaint       Remove the 'tainted' state from a resource instance
  version       Show the current Terraform version
  workspace     Workspace management

Global options (use these before the subcommand, if any):
  -chdir=DIR    Switch to a different working directory before executing the
                given subcommand.
  -help         Show this help output or the help for a specified subcommand.
  -version      An alias for the "version" subcommand.
</pre>



<p>创建三台 vps，指定密钥登陆，添加一个vpc<br/>
main.ts</p>

<pre><span></span>terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~&gt; 2.0"
    }
  }
}

provider "digitalocean" {
  token = "xxxxxxxxxxxxxxxx"
}

resource "digitalocean_ssh_key" "default" {
  name       = "tf-key"
  public_key = "xxxxxxxxxxxxxxxxx"
}

# 添加 VPC
resource "digitalocean_vpc" "main" {
  name     = "tf-vpc"
  region   = "sfo3"
  ip_range = "10.10.0.0/16"
}

variable "hosts" {
  type = map(object({
    name   = string
    region = string
    size   = string
  }))

  default = {
    h1 = { name = "vm-1", region = "sfo3", size = "s-1vcpu-1gb" }
    h2 = { name = "vm-2", region = "sfo3", size = "s-1vcpu-1gb" }
    h3 = { name = "vm-3", region = "sfo3", size = "s-1vcpu-1gb" }
  }
}

resource "digitalocean_droplet" "vm" {
  for_each = var.hosts

  name   = each.value.name
  region = each.value.region
  size   = each.value.size
  image  = "ubuntu-22-04-x64"

  ssh_keys = [digitalocean_ssh_key.default.fingerprint]

  # 绑定到 VPC
  vpc_uuid = digitalocean_vpc.main.id
}

output "ips" {
  value = { for k, d in digitalocean_droplet.vm : k =&gt; d.ipv4_address }
}

output "vpc_id" {
  value = digitalocean_vpc.main.id
}

output "private_ips" {
  value = { for k, d in digitalocean_droplet.vm : k =&gt; d.ipv4_address_private }
}
</pre>



