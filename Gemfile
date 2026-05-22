source "https://rubygems.org"

# Pick ONE of these two depending on where you deploy:

# 1. Local / self-hosted — recommended:
gem "jekyll", "~> 4.3"

gem "sass-embedded", "1.99.0"

# 2. GitHub Pages — comment out the line above and uncomment this:
# gem "github-pages", group: :jekyll_plugins

group :jekyll_plugins do
  gem "jekyll-seo-tag"
  gem "jekyll-sitemap"
end

# Windows / JRuby gems Jekyll needs
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]
