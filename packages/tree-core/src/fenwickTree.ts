export class FenwickTree {
    private tree: number[]

    constructor(size: number) {
        this.tree = new Array(size + 1).fill(0)
    }

    build(values: number[]) {
        for (let i = 0; i < values.length; i++) {
            this.add(i, values[i]!)
        }
    }

    add(index: number, delta: number) {
        for (let i = index + 1; i < this.tree.length; i += i & -i) {
            this.tree[i]! += delta
        }
    }

    sum(index: number): number {
        let res = 0
        for (let i = index + 1; i > 0; i -= i & -i) {
            res += this.tree[i]!
        }
        return res
    }

    range(l: number, r: number): number {
        return this.sum(r - 1) - this.sum(l - 1)
    }
}