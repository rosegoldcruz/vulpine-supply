// Linux Landlock ABI >=4. Fails closed; no root or user namespaces required.
// Limits file content access and TCP ports. This is not PID/UDP isolation.
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/landlock.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <linux/audit.h>
#include <stddef.h>
#include <sys/socket.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>

static void fail(const char *s) { perror(s); exit(126); }
static void path_rule(int fd, const char *path, unsigned long long access) {
  int p = open(path, O_PATH | O_CLOEXEC);
  if (p < 0) { if (errno == ENOENT) return; fail("open rule"); }
  struct stat st;
  if (fstat(p, &st)) fail("stat rule");
  if (!S_ISDIR(st.st_mode)) access &= LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_WRITE_FILE | LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_TRUNCATE;
  struct landlock_path_beneath_attr a = { .allowed_access = access, .parent_fd = p };
  if (syscall(SYS_landlock_add_rule, fd, LANDLOCK_RULE_PATH_BENEATH, &a, 0)) fail("path rule");
  close(p);
}
int main(int argc, char **argv) {
  if (argc < 6) { fprintf(stderr,"usage: restrict online|offline read-paths write-paths -- command...\n"); return 126; }
  int abi = syscall(SYS_landlock_create_ruleset, NULL, 0, LANDLOCK_CREATE_RULESET_VERSION);
  if (abi < 4) { fprintf(stderr,"Landlock ABI >=4 required\n"); return 126; }
  unsigned long long read = LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR | LANDLOCK_ACCESS_FS_EXECUTE;
  unsigned long long all = (1ULL << 15) - 1;
  struct landlock_ruleset_attr attr = { .handled_access_fs = all,
    .handled_access_net = LANDLOCK_ACCESS_NET_BIND_TCP | LANDLOCK_ACCESS_NET_CONNECT_TCP };
  int fd = syscall(SYS_landlock_create_ruleset, &attr, sizeof(attr), 0);
  if (fd < 0) fail("create ruleset");
  const char *system[] = {"/usr","/lib","/lib64","/bin","/sbin","/etc/ssl","/etc/fonts","/etc/ld.so.cache","/etc/resolv.conf","/etc/hosts","/etc/nsswitch.conf","/etc/passwd","/etc/group","/etc/localtime","/etc/gai.conf","/etc/mime.types","/proc","/sys/devices/system/cpu",NULL};
  for (int i=0; system[i]; ++i) path_rule(fd, system[i], read);
  path_rule(fd, "/sys", read); // Chromium enumerates PCI/render capabilities.
  char own_proc[64]; snprintf(own_proc,sizeof(own_proc),"/proc/%d",getpid());
  path_rule(fd, own_proc, read);
  const char *devices[] = {"/dev/null","/dev/zero","/dev/urandom","/dev/random","/dev/shm",NULL};
  for (int i=0; devices[i]; ++i) path_rule(fd, devices[i], all);
  char *save, *p;
  for (p=strtok_r(argv[2],":",&save); p; p=strtok_r(NULL,":",&save)) path_rule(fd,p,read);
  for (p=strtok_r(argv[3],":",&save); p; p=strtok_r(NULL,":",&save)) path_rule(fd,p,all);
  // Website preview is the only permitted bind; offline workers cannot contact
  // production TCP ports. Online model/npm workers may connect to TLS/DNS ports.
  struct landlock_net_port_attr net = { .allowed_access = LANDLOCK_ACCESS_NET_BIND_TCP | LANDLOCK_ACCESS_NET_CONNECT_TCP, .port = 4317 };
  if (syscall(SYS_landlock_add_rule,fd,LANDLOCK_RULE_NET_PORT,&net,0)) fail("network rule");
  if (!strcmp(argv[1],"online")) {
    unsigned short ports[] = {443,53};
    for(int i=0;i<2;i++) { net.allowed_access=LANDLOCK_ACCESS_NET_CONNECT_TCP; net.port=ports[i];
      if(syscall(SYS_landlock_add_rule,fd,LANDLOCK_RULE_NET_PORT,&net,0)) fail("online rule"); }
  }
  if (prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0)) fail("no new privileges");
  if (syscall(SYS_landlock_restrict_self,fd,0)) fail("restrict self");
  close(fd);
  // Procfs and local IPC are needed by Node/Chromium child processes. This is
  // a file-content/TCP boundary for scoped reviewed work, not a hostile-code VM.
  // The queue separately requires SCRAM credentials outside worker read paths.
  struct sock_filter filter[] = {
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS, offsetof(struct seccomp_data, arch)),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, AUDIT_ARCH_X86_64, 1, 0),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_KILL_PROCESS),
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS, offsetof(struct seccomp_data, nr)),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, SYS_ptrace, 0, 1),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ERRNO|EACCES),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, SYS_process_vm_readv, 0, 1),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ERRNO|EACCES),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K, SYS_process_vm_writev, 0, 1),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ERRNO|EACCES),
    BPF_STMT(BPF_RET|BPF_K, SECCOMP_RET_ALLOW),
  };
  struct sock_fprog prog = { .len=sizeof(filter)/sizeof(filter[0]), .filter=filter };
  if (prctl(PR_SET_SECCOMP,SECCOMP_MODE_FILTER,&prog)) fail("seccomp");
  execvp(argv[5],&argv[5]); fail("exec");
}
