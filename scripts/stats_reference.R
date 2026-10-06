# Reference values from base R for the web app's statistics helpers
# (web/src/lib/stats and web/src/lib/lab/benchmark.ts). A second, independent
# check next to scripts/stats_reference.py: the Vitest suite pins numbers that
# both scripts reproduce. Base R only, no packages.
#
#     Rscript scripts/stats_reference.R

x <- c(3.1, 0.4, 2.2, 9.7, 5.5, 1.0, 4.8)

cat("# quantile, type 7 (R's default; numpy 'linear')\n")
print(setNames(quantile(x, c(0.025, 0.1, 0.5, 0.9, 0.975), type = 7), NULL), digits = 17)

cat("\n# normal quantiles\n")
print(qnorm(c(0.001, 0.025, 0.9, 0.975, 0.995)), digits = 17)

cat("\n# Wilson intervals: prop.test(k, n, correct = FALSE)$conf.int\n")
for (kn in list(c(0, 10), c(14, 14), c(7, 12), c(1, 24), c(20, 24))) {
  ci <- suppressWarnings(prop.test(kn[1], kn[2], correct = FALSE)$conf.int)
  cat(sprintf("%d/%d: %.17g %.17g\n", kn[1], kn[2], ci[1], ci[2]))
}

cat("\n# exact McNemar = binom.test(min(b, c), b + c, 0.5)$p.value\n")
for (bc in list(c(5, 1), c(0, 6), c(2, 9), c(1, 106))) {
  p <- binom.test(min(bc), sum(bc), 0.5)$p.value
  cat(sprintf("%d,%d: %.17g\n", bc[1], bc[2], p))
}

cat("\n# order-statistic interval for a median: coverage 1 - 2 pbinom(k - 1, n, 1/2)\n")
median_order_interval <- function(v, level = 0.95) {
  v <- sort(v)
  n <- length(v)
  cover <- function(k) 1 - 2 * pbinom(k - 1, n, 0.5)
  k <- 1
  while (k + 1 <= (n + 1) %/% 2 && cover(k + 1) >= level) k <- k + 1
  c(median = median(v), lo = v[k], hi = v[n - k + 1], coverage = cover(k))
}
print(median_order_interval(x), digits = 17)
for (n in c(5, 6, 7, 10, 15, 20)) {
  cat(sprintf("n = %2d: coverage %.17g\n", n, median_order_interval(seq_len(n))[["coverage"]]))
}

cat("\n# benchmark table (5 rounds x {1, 3, 4, 8} workers, ms)\n")
bench <- data.frame(
  w1 = c(1000, 1040, 985, 1120, 1010),
  w3 = c(380, 395, 370, 410, 377),
  w4 = c(300, 310, 296, 330, 305),
  w8 = c(190, 205, 182, 220, 188)
)
ns <- c(1, 3, 4, 8)
for (j in seq_along(ns)) {
  r <- median_order_interval(bench[[j]])
  cat(sprintf("n = %d: median %.17g, interval %.17g to %.17g, coverage %.17g\n",
              ns[j], r[["median"]], r[["lo"]], r[["hi"]], r[["coverage"]]))
}

cat("\n# Amdahl serial fraction: lm(1/S - 1/n ~ 0 + (1 - 1/n)) on the median speedups\n")
med <- sapply(bench, median)
s <- med[[1]] / med
keep <- ns > 1
fit <- lm(I(1 / s[keep] - 1 / ns[keep]) ~ 0 + I(1 - 1 / ns[keep]))
print(unname(coef(fit)), digits = 17)
cat("Karp-Flatt at n = 8: ")
print((1 / s[[4]] - 1 / 8) / (1 - 1 / 8), digits = 17)
