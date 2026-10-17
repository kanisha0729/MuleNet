import platform
import sys

print("Hello from MuleNet!")
print("Machine:", platform.machine())
print("Python :", sys.version.split()[0])

if platform.machine() == "s390x":
    print("Running on IBM LinuxONE ✅")
else:
    print("Not running on LinuxONE")
