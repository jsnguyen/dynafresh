#!/usr/bin/python3

import matplotlib.pyplot as plt
import numpy as np
import time


while True:
    print('Making plot!')
    xs = np.random.normal(size=100)
    ys = np.random.normal(size=100)
    plt.plot(xs,ys,color='C1')
    plt.savefig('plot2.png',bbox_inches='tight')
    plt.close()
    time.sleep(4)
