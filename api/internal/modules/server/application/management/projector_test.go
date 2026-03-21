package managementapp

import "testing"

func TestParseSystemdServices(t *testing.T) {
	output := "nginx.service loaded active running A high performance web server\npostgresql.service loaded failed failed PostgreSQL database server\n"
	items := parseSystemdServices(output)
	if len(items) != 2 {
		t.Fatalf("expected 2 services, got %d", len(items))
	}
	if items[0].Name != "nginx.service" || items[0].Status != "running" {
		t.Fatalf("unexpected first service: %#v", items[0])
	}
	if items[1].Status != "failed" {
		t.Fatalf("unexpected second service status: %#v", items[1])
	}
}

func TestParseNetworkInterfaces(t *testing.T) {
	output := `[{"ifname":"eth0","link_type":"ether","address":"00:11:22:33:44:55","mtu":1500,"operstate":"UP","addr_info":[{"family":"inet","local":"10.0.0.2","prefixlen":24}]}]`
	items, err := parseNetworkInterfaces("server-1", output)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 interface, got %d", len(items))
	}
	if items[0].Name != "eth0" || items[0].IPAddress != "10.0.0.2" || !items[0].IsUp {
		t.Fatalf("unexpected interface: %#v", items[0])
	}
}

func TestParseHelpers(t *testing.T) {
	if got := parseLatency("64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=12.4 ms"); got != 12.4 {
		t.Fatalf("unexpected latency: %v", got)
	}
	if got := parseLastInteger("ok\n12345\n"); got != 12345 {
		t.Fatalf("unexpected integer: %v", got)
	}
	if got := tailLine("\nerror one\nerror two\n"); got != "error two" {
		t.Fatalf("unexpected tail line: %q", got)
	}
}
