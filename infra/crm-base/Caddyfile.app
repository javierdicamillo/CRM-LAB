{$CRM_DOMAIN} {
	encode zstd gzip
	request_body {
		max_size 12MB
	}
	header {
		-Server
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		X-Robots-Tag "noindex, nofollow"
	}
	reverse_proxy app:3000 {
		header_up X-Real-IP {remote_host}
	}
}

www.{$CRM_DOMAIN} {
	redir https://{$CRM_DOMAIN}{uri} permanent
}
