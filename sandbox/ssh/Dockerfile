FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Cài SSH
RUN apt-get update && \
    apt-get install -y openssh-server sudo && \
    mkdir /var/run/sshd

# Tạo user test
RUN useradd -m -s /bin/bash dev && \
    echo 'dev:123456' | chpasswd && \
    adduser dev sudo

# Enable password login
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Fix PAM
RUN sed -i 's/session required pam_loginuid.so/session optional pam_loginuid.so/' /etc/pam.d/sshd

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D"]
